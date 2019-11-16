import { Oops } from "oops-error"
import * as path from "path"
import { emptyArray } from "../helpers/ts-functions"

import { expandEnv } from "../expandenv"
import { TImageDeploymentPlan } from "./deployment-types"
import { TBranchModificationParams } from "../k8s-feature-deployment/create-name-change-index"
import { modifyDeploymentDocument } from "../k8s-feature-deployment/modify-deployment-document"

const identifyDocument = require("../k8s-deployment-document-identifier")
const expandTemplate = require("../expandtemplate")

const applyClusterPolicies = require("../apply-k8s-policy").applyPoliciesToDoc
const base64EnvSubst = require("../base64-env-subst").processLine
const options = require("./options")

const addResourceNameChangeIndex = require("../k8s-feature-deployment/create-name-change-index").addResourceNameChangeIndex

function calculateDeployerAction(imageInformation): Array<TImageDeploymentPlan> {

  const shepherdMetadata = imageInformation.shepherdMetadata
  const herdKey: string = imageInformation.imageDefinition.herdKey
  const displayName: string = imageInformation.shepherdMetadata.displayName


  let dockerImageWithVersion =
    imageInformation.imageDefinition.dockerImage ||
    imageInformation.imageDefinition.image + ":" + imageInformation.imageDefinition.imagetag

  const plan: TImageDeploymentPlan = {
    displayName: displayName,
    metadata: shepherdMetadata,
    herdSpec: imageInformation.imageDefinition,
    dockerParameters: ["-i", "--rm"],
    forTestParameters: undefined,
    imageWithoutTag: dockerImageWithVersion.replace(/:.*/g, ""), // For regression testing
    origin: herdKey,
    type: "deployer",
    operation: "run",
    command: "deploy",
    identifier: herdKey,
    herdKey: herdKey,
  }

  let envList = ["ENV={{ ENV }}"]

  plan.command = shepherdMetadata.deployCommand || plan.command
  if (shepherdMetadata.environmentVariablesExpansionString) {
    const envLabel = expandEnv(shepherdMetadata.environmentVariablesExpansionString)
    envList = envList.concat(envLabel.split(","))
  }
  if (shepherdMetadata.environment) {
    envList = envList.concat(shepherdMetadata.environment.map(value => `${value.name}=${value.value}`))
  }

  envList.forEach(function(env_item) {
    plan.dockerParameters.push("-e")
    plan.dockerParameters.push(expandTemplate(env_item))
  })

  plan.forTestParameters = plan.dockerParameters.slice(0) // Clone array

  plan.dockerParameters.push(dockerImageWithVersion)
  plan.forTestParameters.push(plan.imageWithoutTag + ":[image_version]")

  if (plan.command) {
    plan.dockerParameters.push(plan.command)
    plan.forTestParameters.push(plan.command)
  }
  return [plan]
}


export function createImageDeploymentPlanner(injected) {
  const kubeSupportedExtensions = injected("kubeSupportedExtensions")
  const logger = injected("logger")

  async function createK8sFileDeploymentAction(deploymentFileContent, imageInformation, fileName, featureDeploymentConfig) {
    let origin =
      imageInformation.imageDefinition.image + ":" + imageInformation.imageDefinition.imagetag + ":kube.config.tar.base64"

    // Support mustache template expansion as well as envsubst template expansion

    let lines = deploymentFileContent.content.split("\n")
    let fileContents
    try {
      if (options.testRunMode()) {
        process.env.TPL_DOCKER_IMAGE = "fixed-for-testing-purposes"
      } else {
        process.env.TPL_DOCKER_IMAGE =
          imageInformation.imageDefinition.image + ":" + imageInformation.imageDefinition.imagetag
      }
      lines.forEach(function(line, idx) {
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
      fileContents = expandTemplate(fileContents)

      delete process.env.TPL_DOCKER_IMAGE
    } catch (error) {
      // console.error( error)
      // console.log('ORIGINAL MESSAGE', error.message)

      let message = `In deployment image ${origin}\n In file ${fileName} \n`
      message += error.message

      throw new Oops({ message, category: "OperationalError", cause: error })
    }
    if (imageInformation.isTargetForFeatureDeployment) {
      fileContents = modifyDeploymentDocument(fileContents, featureDeploymentConfig)
      origin = featureDeploymentConfig.origin
    }

    let deploymentDescriptor = applyClusterPolicies(fileContents, logger)

    let loadedDescriptor = identifyDocument(deploymentDescriptor)
    let documentIdentifier = loadedDescriptor.identifyingString
    let descriptorsByKind = loadedDescriptor.descriptorsByKind

    let deploymentRollouts = []
    if (Boolean(descriptorsByKind["Deployment"])) {
      deploymentRollouts = descriptorsByKind["Deployment"].map((deploymentDoc) => {
        return deploymentDoc.kind + "/" + deploymentDoc.metadata.name
      })
    }

    return {
      herdSpec: imageInformation.imageDefinition,
      metadata: imageInformation.shepherdMetadata,
      operation: imageInformation.imageDefinition.delete ? "delete" : "apply",
      identifier: documentIdentifier,
      version: imageInformation.imageDefinition.imagetag,
      descriptor: deploymentDescriptor,
      origin: origin,
      type: "k8s",
      fileName: fileName,
      herdKey: imageInformation.imageDefinition.herdKey,
      deploymentRollouts: deploymentRollouts,
    }
  }

  function calculateKubectlActions(imageInformation ) {

    const shepherdMetadata: any = imageInformation.shepherdMetadata
    const herdKey: string = imageInformation.imageDefinition.herdKey
    const displayName: string = imageInformation.shepherdMetadata.displayName

    const plan: any = {
      herdKey: herdKey,
      displayName: displayName,
    }

    plan.files = shepherdMetadata.kubeDeploymentFiles
    plan.deployments = {}
    plan.dockerLabels = imageInformation.dockerLabels


    let deploymentActions = emptyArray<any>()

    let branchDeploymentEnabled = imageInformation.imageDefinition.featureDeployment

    const branchModificationParams : TBranchModificationParams = {}

    if (branchDeploymentEnabled) {

      // console.log('featureDeploymentIsEnabled', branchDeploymentEnabled)
      branchModificationParams.ttlHours =
        imageInformation.imageDefinition.timeToLiveHours || branchModificationParams.ttlHours

      imageInformation.isTargetForFeatureDeployment = imageInformation.imageDefinition.featureDeployment

        // Feature deployment specified in herdfile
      branchModificationParams.branchName = imageInformation.imageDefinition.branchName || imageInformation.imageDefinition.herdKey
      branchModificationParams.origin = imageInformation.imageDefinition.herdKey + "::" + branchModificationParams.branchName

      imageInformation.origin = branchModificationParams.origin
    }

    if (imageInformation.isTargetForFeatureDeployment) {
      if (!Boolean(branchModificationParams.ttlHours)) {
        throw new Error(
          `${imageInformation.imageDefinition.herdKey}: Time to live must be specified either through FEATURE_TTL_HOURS environment variable or be declared using timeToLiveHours property in herd.yaml`,
        )
      }
      addResourceNameChangeIndex(
        plan,
        kubeSupportedExtensions,
        branchModificationParams,
      )
    }

    Object.entries(plan.files as Array<any>).forEach(([fileName, deploymentFileContent]) => {
      if (!kubeSupportedExtensions[path.extname(fileName)]) {
        // console.debug('Unsupported extension ', path.extname(fileName));
        return
      }

      try {
        if (deploymentFileContent.content) {
          // let deployment = calculateFileDeploymentPlan();
          //
          // let addDeploymentPromise = releasePlan.addK8sDeployment(deployment);
          deploymentActions.push(
            createK8sFileDeploymentAction(deploymentFileContent, imageInformation, fileName, branchModificationParams),
          )
        }
      } catch (e) {
        let error = "When processing " + fileName + ":\n"
        throw new Error(error + e.message)
      }
    })
    return Promise.all(deploymentActions)
  }

  async function calculateDeploymentActions(imageInformation) {
    if (imageInformation.shepherdMetadata) {

      if (imageInformation.shepherdMetadata.deploymentType === "deployer") {
        return calculateDeployerAction(imageInformation)
      } else if (imageInformation.shepherdMetadata.deploymentType === "k8s") {
        return calculateKubectlActions(imageInformation)
      } else {
        throw new Error(`Unexpected: No planner in place for deploymentType ${imageInformation.shepherdMetadata.deploymentType} in ${imageInformation.shepherdMetadata.displayName} `)
      }
    }
  }

  return { calculateDeploymentActions: calculateDeploymentActions }
}
