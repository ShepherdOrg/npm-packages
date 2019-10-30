const identifyDocument = require("../k8s-deployment-document-identifier")

const expandEnv = require("../expandenv")
const expandtemplate = require("../expandtemplate")

const applyClusterPolicies = require("../apply-k8s-policy").applyPoliciesToDoc
const modifyDeploymentDocument = require("../k8s-feature-deployment/modify-deployment-document")
  .modifyRawDocument
const base64EnvSubst = require("../base64-env-subst").processLine
const options = require("./options")
const path = require("path")
const _ = require("lodash")

const createResourceNameChangeIndex = require("../k8s-feature-deployment/create-name-change-index")

module.exports = function(injected) {
  const kubeSupportedExtensions = injected("kubeSupportedExtensions")
  const logger = injected("logger")

  function calculateFileDeploymentPlan(
    deploymentFileContent,
    imageMetadata,
    fileName,
    featureDeploymentConfig
  ) {
    return new Promise(function(resolve, reject) {
      let origin =
        imageMetadata.imageDefinition.image +
        ":" +
        imageMetadata.imageDefinition.imagetag +
        ":kube.config.tar.base64"

      // Support mustache template expansion as well as envsubst template expansion

      let lines = deploymentFileContent.content.split("\n")
      let fileContents
      try {
        if (options.testRunMode()) {
          process.env.TPL_DOCKER_IMAGE = "fixed-for-testing-purposes"
        } else {
          process.env.TPL_DOCKER_IMAGE =
            imageMetadata.imageDefinition.image +
            ":" +
            imageMetadata.imageDefinition.imagetag
        }
        _.each(lines, function(line, idx) {
          try {
            lines[idx] = expandEnv(line)
            lines[idx] = base64EnvSubst(lines[idx], {})
          } catch (error) {
            let message = `Error expanding variables in line #${idx}: ${line}\n`
            message += error
            throw new Error(message)
          }
        })
        fileContents = lines.join("\n")
        fileContents = expandtemplate(fileContents)

        delete process.env.TPL_DOCKER_IMAGE
      } catch (error) {
        // console.error( error)
        // console.log('ORIGINAL MESSAGE', error.message)

        let message = `In deployment image ${origin}\n In file ${fileName} \n`
        message += error.message

        let augmentedError = new Error(message)

        augmentedError.cause = error
        reject(augmentedError)
        return
      }
      if (featureDeploymentConfig.isFeatureDeployment) {
        fileContents = modifyDeploymentDocument(
          fileContents,
          featureDeploymentConfig
        )
        origin = featureDeploymentConfig.origin
      }

      let deploymentDescriptor = applyClusterPolicies(fileContents, logger)

      let documentIdentifier = identifyDocument(deploymentDescriptor)

      let plan = {
        herdSpec: imageMetadata.imageDefinition,
        metadata: imageMetadata.shepherdMetadata,
        operation: imageMetadata.imageDefinition.delete ? "delete" : "apply",
        identifier: documentIdentifier,
        version: imageMetadata.imageDefinition.imagetag,
        descriptor: deploymentDescriptor,
        origin: origin,
        type: "k8s",
        fileName: fileName,
        herdName: imageMetadata.imageDefinition.herdName,
      }
      resolve(plan)
    })
  }

  function calculateImagePlan(imageInformation) {
    if (imageInformation.shepherdMetadata) {
      const shepherdMetadata = imageInformation.shepherdMetadata

      return Promise.resolve().then(() => {
        let plan = {
          displayName: shepherdMetadata.displayName,
          herdName: imageInformation.imageDefinition.herdName, // TODO Rename imageDefinition -> herdSpec
        }

        if (shepherdMetadata.deploymentType === "deployer") {
          let dockerImageWithVersion =
            imageInformation.imageDefinition.dockerImage ||
            imageInformation.imageDefinition.image +
              ":" +
              imageInformation.imageDefinition.imagetag

          Object.assign(plan, {
            metadata: shepherdMetadata,
            herdSpec: imageInformation.imageDefinition,
            dockerParameters: ["-i", "--rm", "-e", expandEnv("ENV=${ENV}")],
            forTestParameters: undefined,
            imageWithoutTag: dockerImageWithVersion.replace(/:.*/g, ""), // For regression testing
            origin: plan.herdName,
            type: "deployer",
            operation: "run",
            command: "deploy",
            identifier: plan.herdName,
          })

          let envList = []

          plan.command = shepherdMetadata.deployCommand || plan.command
          if (shepherdMetadata.environmentVariablesExpansionString) {
            const envLabel = expandEnv(
              shepherdMetadata.environmentVariablesExpansionString
            )
            envList = envList.concat(envLabel.split(","))
          }

          envList.forEach(function(env_item) {
            plan.dockerParameters.push("-e")
            plan.dockerParameters.push(env_item)
          })

          plan.forTestParameters = plan.dockerParameters.slice(0) // Clone array

          plan.dockerParameters.push(dockerImageWithVersion)
          plan.forTestParameters.push(plan.imageWithoutTag + ":[image_version]")

          if (plan.command) {
            plan.dockerParameters.push(plan.command)
            plan.forTestParameters.push(plan.command)
          }
        } else {
          if (shepherdMetadata.deploymentType === "k8s") {
            const files = shepherdMetadata.kubeDeploymentFiles

            plan.files = files
            plan.deployments = {}
            plan.dockerLabels = imageInformation.dockerLabels
            let planPromises = []
            let featureDeploymentConfig = {
              isFeatureDeployment: false,
            }

            if (
              process.env.UPSTREAM_IMAGE_NAME ===
                imageInformation.imageDefinition.herdName &&
              process.env.FEATURE_NAME
            ) {
              let cleanedName = process.env.FEATURE_NAME.replace(
                /\//g,
                "-"
              ).toLowerCase()
              featureDeploymentConfig.isFeatureDeployment = true
              featureDeploymentConfig.ttlHours = process.env.FEATURE_TTL_HOURS
              featureDeploymentConfig.newName = cleanedName
              featureDeploymentConfig.origin =
                imageInformation.imageDefinition.herdName + "::" + cleanedName
            }

            if (imageInformation.imageDefinition.featureDeployment) {
              featureDeploymentConfig.isFeatureDeployment = true
              featureDeploymentConfig.ttlHours =
                imageInformation.imageDefinition.timeToLiveHours ||
                featureDeploymentConfig.ttlHours
              featureDeploymentConfig.newName =
                imageInformation.imageDefinition.herdName
              featureDeploymentConfig.origin =
                imageInformation.imageDefinition.herdName + "::feature"
            }

            if (featureDeploymentConfig.isFeatureDeployment) {
              if (!Boolean(featureDeploymentConfig.ttlHours)) {
                throw new Error(
                  `${imageInformation.imageDefinition.herdName}: Time to live must be specified either through FEATURE_TTL_HOURS environment variable or be declared using timeToLiveHours property in herd.yaml`
                )
              }
              try {
                if (typeof featureDeploymentConfig.ttlHours === "string") {
                  featureDeploymentConfig.ttlHours = parseInt(
                    featureDeploymentConfig.ttlHours,
                    10
                  )
                }
              } catch (err) {
                throw new Error(
                  `Error parsing time-to-live-hours setting ${featureDeploymentConfig.ttlHours}, must be an integer`
                )
              }

              featureDeploymentConfig.nameChangeIndex = createResourceNameChangeIndex(
                plan,
                kubeSupportedExtensions,
                featureDeploymentConfig
              )
            }

            _.forEach(plan.files, function(deploymentFileContent, fileName) {
              if (!kubeSupportedExtensions[path.extname(fileName)]) {
                // console.debug('Unsupported extension ', path.extname(fileName));
                return
              }

              try {
                if (deploymentFileContent.content) {
                  // let deployment = calculateFileDeploymentPlan();
                  //
                  // let addDeploymentPromise = releasePlan.addK8sDeployment(deployment);
                  planPromises.push(
                    calculateFileDeploymentPlan(
                      deploymentFileContent,
                      imageInformation,
                      fileName,
                      featureDeploymentConfig
                    )
                  )
                }
              } catch (e) {
                let error = "When processing " + fileName + ":\n"
                reject(error + e)
              }
            })
            return Promise.all(planPromises)
          } else {
            throw new Error(
              `FALLING THROUGH ${shepherdMetadata.displayName} - ${shepherdMetadata.deploymentType}`
            )
          }
        }

        return [plan]
      })
    }
  }

  return calculateImagePlan
}
