const fs = require("fs")
const path = require("path")
const YAML = require("js-yaml")
const inject = require("@shepherdorg/nano-inject").inject

const Promise = require("bluebird").Promise

const kubeSupportedExtensions = require("./kubeSupportedExtensions")

const ImageDeployermentPlanner = require("./image-deployment-planner")

const addShepherdMetadata = require("./add-shepherd-metadata")

function splitDockerImageTag(imgObj) {
  let colonIdx = imgObj.dockerImage.indexOf(":")
  imgObj.image = imgObj.dockerImage.slice(0, colonIdx)
  imgObj.imagetag = imgObj.dockerImage.slice(
    colonIdx + 1,
    imgObj.dockerImage.length
  )
}

module.exports = function(injected) {
  const ReleasePlan = injected("ReleasePlan")

  const labelsLoader =
    injected("labelsLoader", true) ||
    require("@shepherdorg/docker-image-metadata-loader")
  const logger = injected("logger")

  const featureDeploymentData = {
    isFeatureDeployment: false,
  }

  const calculateDeploymentPlan = ImageDeployermentPlanner(
    inject({
      kubeSupportedExtensions,
      logger,
      featureDeploymentData
    })
  ).createImageDeployerPlan

  const scanDir = require("./folder-deployment-planner")(
    inject({
      kubeSupportedExtensions: {
        ".yml": true,
        ".yaml": true,
        ".json": true,
      },
      logger,
    })
  )

  // const cmd = injected('exec');

  const dockerRegistries = labelsLoader.getDockerRegistryClientsFromConfig()
  const loader = labelsLoader.imageLabelsLoader(
    inject({ dockerRegistries: dockerRegistries, logger: logger })
  )

  function calculateFoldersPlan(herdFilePath, herdFolder) {
    let resolvedPath = path.resolve(herdFilePath, herdFolder.path)

    logger.info(`Scanning ${resolvedPath} for kubernetes deployment documents`)

    return scanDir(resolvedPath)
  }

  function loadImageMetadata(imageDef) {
    return loader.getImageLabels(imageDef)
  }

  return {
    loadHerd(fileName, environment) {
      return new Promise(function(resolve, reject) {
        try {
          if (fs.existsSync(fileName)) {
            let releasePlan = ReleasePlan(environment)

            let infrastructurePromises = []
            let allDeploymentPromises = []
            const imagesPath = path.dirname(fileName)

            let herd = YAML.load(fs.readFileSync(fileName, "utf8"))

            let imageDependencies = {}

            function addMigrationImageToDependenciesPlan(imageMetaData) {
              return new Promise(function(resolve, reject) {
                let dependency
                if (imageMetaData.shepherdMetadata.migrationImage) {
                  dependency = imageMetaData.shepherdMetadata.migrationImage
                }
                if (dependency) {
                  imageDependencies[dependency] = {
                    dockerImage: dependency,
                  }
                }

                resolve(imageMetaData)
              })
            }

            let infrastructureLoader = function(infrastructureImages) {
              return new Promise(function(resolve) {
                resolve(
                  Object.entries(infrastructureImages).map(function(
                    [herdKey, herdDefinition]
                  ) {
                    herdDefinition.herdKey = herdKey
                    return loadImageMetadata(herdDefinition)
                      .then(calculateDeploymentPlan)
                      .catch(function(e) {
                        reject(
                          new Error(
                            "When processing " +
                              herdKey +
                              ": " +
                              e +
                              (e.stack ? e.stack : "")
                          )
                        )
                      })
                  })
                )
              });
            }

            infrastructurePromises.push(
              infrastructureLoader(herd.infrastructure || {})
                .then(function(addedPromises) {
                  return Promise.all(addedPromises).catch(reject)
                })
                .catch(reject)
            )

            let loaders = {
              folders: function(folders) {
                return new Promise(function(resolve) {
                  resolve(
                    Object.entries(folders).map(function([ herdFolderName, herdFolder]) {
                      herdFolder.herdKey = herdFolderName

                      return calculateFoldersPlan(imagesPath, herdFolder)
                        .then(function(plans) {
                          return Promise.each(plans, function(deploymentPlan) {
                            deploymentPlan.herdKey = `${herdFolder.herdKey} - ${deploymentPlan.origin}`
                            deploymentPlan.herdSpec = {
                              herdKey: herdFolder.herdKey,
                              path: herdFolder.path,
                              description: herdFolder.description

                            }
                            deploymentPlan.metadata = {
                              displayName: deploymentPlan.fileName,
                              semanticVersion: "0",
                              deploymentType: 'k8s',
                              buildDate: new Date(0), // Might make sense to extract change timestamp on file from filesystem or git
                              hyperlinks: []
                            }
                            return releasePlan.addDeployment(deploymentPlan)
                          })
                        })
                        .catch(function(e) {
                          reject(
                            "When processing folder " +
                              herdFolderName +
                              "\n" +
                              e +
                              (e.stack ? e.stack : "")
                          )
                        })
                    })
                  )
                });
              },
              images: function(images) {
                return new Promise(function(resolve) {
                  resolve(
                     Object.entries(images).map(function([ imgName, imgObj]) {
                      imgObj.herdKey = imgName
                      logger.debug(
                        "Deployment image - loading image meta data for docker image",
                        JSON.stringify(imgObj)
                      )

                      if (!imgObj.image && imgObj.dockerImage) {
                        splitDockerImageTag(imgObj)
                      }
                      return loadImageMetadata(imgObj)
                        .then(addShepherdMetadata)
                        .then(addMigrationImageToDependenciesPlan)
                        .then(calculateDeploymentPlan)
                        .then(function(imagePlans) {
                          return Promise.each(
                            imagePlans,
                            releasePlan.addDeployment
                          )
                        })
                        .then(function(imgPlans) {
                          return imgPlans
                        })
                        .catch(function(e) {
                          let errorMessage =
                            "When processing image " +
                            imgName +
                            "\n" +
                            e.message +
                            (e.stack ? e.stack : "")
                          reject(new Error(errorMessage))
                        })
                    })
                  )
                });
              },
            }

            Promise.resolve({}).then(function() {
              Object.entries(herd).forEach(([herdType, herderDefinition])=>{
                if (loaders[herdType]) {
                  allDeploymentPromises.push(
                      loaders[herdType](herderDefinition)
                          .then(function(addedPromises) {
                            return Promise.all(addedPromises).catch(function(e) {
                              reject(e)
                            })
                          })
                          .catch(reject)
                  )
                }

              })

              Promise.all(allDeploymentPromises)
                .then(function() {
                  return loaders
                    .images(imageDependencies)
                    .then(function(planPromises) {
                      return Promise.all(planPromises).catch(function(e) {
                        reject(e)
                      })
                    })
                    .catch(function(e) {
                      reject(e)
                    })
                })
                .then(function() {
                  resolve(releasePlan)
                })
                .catch(reject)
            })
          } else {
            reject(fileName + " does not exist!")
          }
        } catch (e) {
          reject(e)
        }
      });
    },
  };
}
