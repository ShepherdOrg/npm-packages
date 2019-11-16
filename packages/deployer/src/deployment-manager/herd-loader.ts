import * as fs from "fs"
import * as path from "path"
import { emptyArray } from "../helpers/ts-functions"
import { kubeSupportedExtensions } from "./kubectl-deployer/kube-supported-extensions"

const YAML = require("js-yaml")
const inject = require("@shepherdorg/nano-inject").inject

import Bluebird = require("bluebird")
import {
  TFolderDeploymentPlan,
  THerdFolderMap,
  THerdFolderSpec, TImageDeploymentAction,
  TImageMap,
  TInfrastructureImageMap,
} from "./deployment-types"
import { getShepherdMetadata } from "./add-shepherd-metadata"
import { createImageDeploymentPlanner } from "./image-deployment-planner"
import { TK8sDeploymentAction } from "./kubectl-deployer/create-image-based-kubectl-deployment-action"
// declare var Promise: Bluebird<any>;



function splitDockerImageTag(imgObj) {
  let colonIdx = imgObj.dockerImage.indexOf(":")
  imgObj.image = imgObj.dockerImage.slice(0, colonIdx)
  imgObj.imagetag = imgObj.dockerImage.slice(colonIdx + 1, imgObj.dockerImage.length)
}


module.exports = function(injected) {
  const ReleasePlan = injected("ReleasePlan")

  const featureDeploymentConfig = injected("featureDeploymentConfig")

  const labelsLoader = injected("labelsLoader", true) || require("@shepherdorg/docker-image-metadata-loader")
  const logger = injected("logger")

  const calculateDeploymentPlan = createImageDeploymentPlanner(
    inject({
      kubeSupportedExtensions,
      logger,
      featureDeploymentConfig,
    }),
  ).calculateDeploymentActions

  const scanDir = require("./kubectl-deployer/folder-deployment-planner")(
    inject({
      kubeSupportedExtensions: {
        ".yml": true,
        ".yaml": true,
        ".json": true,
      },
      logger,
    }),
  )

  // const cmd = injected('exec');

  const dockerRegistries = labelsLoader.getDockerRegistryClientsFromConfig()
  const loader = labelsLoader.imageLabelsLoader(inject({ dockerRegistries: dockerRegistries, logger: logger }))

  function calculateFoldersPlan(herdFilePath, herdFolder: THerdFolderSpec) {
    let resolvedPath = path.resolve(herdFilePath, herdFolder.path)

    logger.info(`Scanning ${resolvedPath} for kubernetes deployment documents`)

    return scanDir(resolvedPath)
  }

  function loadImageMetadata(imageDef) {
    return loader.getImageLabels(imageDef)
  }

  return {
    loadHerd(fileName, environment?) {
      return new Promise(function(resolve, reject) {
        try {
          if (fs.existsSync(fileName)) {
            let releasePlan = ReleasePlan(environment)

            let infrastructurePromises = emptyArray<any>()
            let allDeploymentPromises = emptyArray<any>()
            const imagesPath = path.dirname(fileName)

            let herd
            if (featureDeploymentConfig.isUpstreamFeatureDeployment()) {
              herd = featureDeploymentConfig.asHerd()
            } else {
              herd = YAML.load(fs.readFileSync(fileName, "utf8"))
            }


            let imageDependencies = {}

            async function addMigrationImageToDependenciesPlan(imageMetaData: any) {
              let dependency
              if (imageMetaData.shepherdMetadata.migrationImage) {
                dependency = imageMetaData.shepherdMetadata.migrationImage
              }
              if (dependency) {
                imageDependencies[dependency] = {
                  dockerImage: dependency,
                }
              }

              return imageMetaData
            }

            let infrastructureLoader = function(infrastructureImages) {
              return new Promise(function(resolve) {
                resolve(
                  Object.entries(infrastructureImages as TInfrastructureImageMap).map(function([
                                                                                                 herdKey,
                                                                                                 herdDefinition,
                                                                                               ]) {
                    herdDefinition.herdKey = herdKey
                    return loadImageMetadata(herdDefinition)
                      .then(calculateDeploymentPlan)
                      .catch(function(e) {
                        reject(new Error("When processing " + herdKey + ": " + e + (e.stack ? e.stack : "")))
                      })
                  }),
                )
              })
            }

            infrastructurePromises.push(
              infrastructureLoader(herd.infrastructure || {})
                .then(function(addedPromises) {
                  return Bluebird.all(addedPromises).catch(reject)
                })
                .catch(reject),
            )

            let loaders = {
              "folders": async function(folders: THerdFolderMap) : Promise<Array<Promise<TFolderDeploymentPlan>>> {

                return Object.entries(folders).flatMap(function([herdFolderName, herdFolder]) {
                  herdFolder.herdKey = herdFolderName

                  return calculateFoldersPlan(imagesPath, herdFolder)
                    .then(function(plans) {
                      return Bluebird.each(plans, function(deploymentPlan: TFolderDeploymentPlan) {
                        deploymentPlan.herdKey = `${herdFolder.herdKey} - ${deploymentPlan.origin}`
                        deploymentPlan.herdSpec = {
                          herdKey: herdFolder.herdKey,
                          path: herdFolder.path,
                          description: herdFolder.description,
                        }
                        deploymentPlan.metadata = {
                          displayName: deploymentPlan.fileName,
                          semanticVersion: "0",
                          deploymentType: "k8s",
                          buildDate: new Date(0), // Might make sense to extract change timestamp on file from filesystem or git
                          hyperlinks: [],
                        }
                        return releasePlan.addDeployment(deploymentPlan)
                      })
                    })
                    .catch(function(e) {
                      throw new Error("When processing folder " + herdFolderName + "\n" + e + (e.stack ? e.stack : ""))
                    })
                })
              },
              "images": async function(images: TImageMap) : Promise<Array<Promise<TImageDeploymentAction>>> {
                let imageDeploymentPlans: Array<Promise<TImageDeploymentAction>> = Object.entries(images).map(function([imgName, imgObj]) {
                  imgObj.herdKey = imgName
                  logger.debug(
                    "Deployment image - loading image meta data for docker image",
                    JSON.stringify(imgObj),
                  )

                  if (!imgObj.image && imgObj.dockerImage) {
                    splitDockerImageTag(imgObj)
                  }
                  let promise = loadImageMetadata(imgObj)
                    .then(getShepherdMetadata)
                    .then(addMigrationImageToDependenciesPlan)/// This is pretty ugly, adding to external structure sideffect
                    .then(calculateDeploymentPlan)
                    .then(function(imagePlans) {
                      return Bluebird.each(imagePlans, releasePlan.addDeployment)
                    })
                    .then(function(imgPlans: Array<TImageDeploymentAction | TK8sDeploymentAction>) {
                      return imgPlans
                    })
                    .catch(function(e) {
                      if(typeof e === 'string'){
                        console.log('STRING!')
                        console.log(typeof e)
                        console.log(e)

                      }
                      let errorMessage =
                        "When processing image " + imgName + "\n" + e.message + (e.stack ? e.stack : "")
                      throw new Error(errorMessage)
                    })
                  return promise
                })
                return imageDeploymentPlans
              },
            }

            Promise.resolve({}).then(function() {
              Object.entries(herd).forEach(([herdType, herderDefinition]) => {
                if (loaders[herdType]) {
                  allDeploymentPromises.push(
                    loaders[herdType](herderDefinition)
                      .then(function(addedPromises) {
                        return Promise.all(addedPromises).catch(function(e) {
                          reject(e)
                        })
                      }),
                  )
                } else {
                  // throw new Error('No loader registered for type ' + herdType)
                }
              })

              // Resolve all deployment definitions asynchronously
              Bluebird.all(allDeploymentPromises)
                .then(function() {
                  // Add plans from image dependencies
                  return loaders
                    .images(imageDependencies)
                    .then(function(planPromises) {
                      return Bluebird.all(planPromises).catch(function(e) {
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
            reject(new Error(fileName + " does not exist!"))
          }
        } catch (e) {
          reject(e)
        }
      })
    },
  }
}
