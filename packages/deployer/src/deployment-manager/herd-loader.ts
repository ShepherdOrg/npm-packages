import * as fs from "fs"
import * as path from "path"
import { emptyArray } from "../helpers/ts-functions"
import { kubeSupportedExtensions } from "./kubectl-deployer/kube-supported-extensions"

import {
  FReleasePlanner,
  ILog,
  OmitKey,
  TAnyDeploymentAction,
  TDockerDeploymentAction,
  TDockerImageHerdSpec,
  TFolderHerdSpec,
  THerdFolderMap,
  TImageMap,
  TInfrastructureImageMap,
  TK8sDirDeploymentAction,
  TK8sDockerImageDeploymentAction, TReleasePlan,
} from "./deployment-types"
import { getShepherdMetadata } from "./add-shepherd-metadata"
import { createImageDeploymentPlanner } from "./image-deployment-planner"
import { getDockerRegistryClientsFromConfig, imageLabelsLoader } from "@shepherdorg/docker-image-metadata-loader"
import { planFolderDeployment } from "./kubectl-deployer/folder-deployment-planner"
import { TFeatureDeploymentConfig, THerdFileStructure } from "./create-upstream-trigger-deployment-config"

const YAML = require("js-yaml")

import Bluebird = require("bluebird")
import { TFileSystemPath } from "../basic-types"
import { TDockerImageReference } from "@shepherdorg/docker-image-metadata-loader/dist/local-image-metadata"

function splitDockerImageTag(dockerImageRefWithTag: string): { image: string; imagetag: string } {
  let colonIdx = dockerImageRefWithTag.indexOf(":")
  return {
    image: dockerImageRefWithTag.slice(0, colonIdx),
    imagetag: dockerImageRefWithTag.slice(colonIdx + 1, dockerImageRefWithTag.length),
  }
}

export type TDockerMetadataLoader = {
  imageLabelsLoader: typeof imageLabelsLoader
  getDockerRegistryClientsFromConfig: typeof getDockerRegistryClientsFromConfig
}

export type THerdLoaderDependencies = {
  logger: ILog
  featureDeploymentConfig: TFeatureDeploymentConfig
  ReleasePlan: FReleasePlanner
  exec: any
  labelsLoader: TDockerMetadataLoader
}

export type TImageDependencyMap = { [imageRef: string]: OmitKey<TDockerImageHerdSpec> }

// TODO This type makes no sense. Have to invest some time creating something sensible here.
export type TLoaderFunction = (arg: TImageDependencyMap |  OmitKey<TDockerImageHerdSpec> | THerdFolderMap | TImageMap) => Promise<Array<Promise<Array<TAnyDeploymentAction>>>>

export type TLoaderMap = { [index: string]: TLoaderFunction }

export interface THerdLoader {
  loadHerd(herdFilePath: TFileSystemPath, environment?: string ): Promise<TReleasePlan>
}

export function HerdLoader(injected: THerdLoaderDependencies): THerdLoader {
  const ReleasePlan = injected.ReleasePlan

  const featureDeploymentConfig = injected.featureDeploymentConfig
  const logger = injected.logger

  const calculateDeploymentPlan = createImageDeploymentPlanner({
    kubeSupportedExtensions,
    logger,
  }).calculateDeploymentActions

  const folderPlanner = planFolderDeployment({
    kubeSupportedExtensions: {
      ".yml": true,
      ".yaml": true,
      ".json": true,
    },
    logger,
  })

  // const cmd = injected('exec');

  const dockerRegistries = injected.labelsLoader.getDockerRegistryClientsFromConfig()
  const loader = injected.labelsLoader.imageLabelsLoader({ dockerRegistries: dockerRegistries, logger: logger })

  function calculateFoldersPlan(herdFilePath:TFileSystemPath, herdFolder: TFolderHerdSpec) {
    let resolvedPath = path.resolve(herdFilePath, herdFolder.path)

    logger.info(`Scanning ${resolvedPath} for kubernetes deployment documents`)

    return folderPlanner.scanDir(resolvedPath, herdFolder)
  }

  function loadImageMetadata(imageDef: TDockerImageReference) {
    return loader.getImageLabels(imageDef)
  }

  return {
    loadHerd(fileName:TFileSystemPath, environment: string) {
      return new Promise(function(resolve, reject) {
        try {
          if (fs.existsSync(fileName)) {
            let releasePlan = ReleasePlan(environment)

            let infrastructurePromises = emptyArray<any>()
            let allPlanningPromises = emptyArray<any>()
            const imagesPath = path.dirname(fileName)

            let herd: THerdFileStructure
            if (featureDeploymentConfig.isUpstreamFeatureDeployment()) {
              herd = featureDeploymentConfig.asHerd()
            } else {
              herd = YAML.load(fs.readFileSync(fileName, "utf8"))
            }

            let imageDependencies: TImageDependencyMap = {}

            async function addMigrationImageToDependenciesPlan(imageMetaData: any) {
              if (imageMetaData.shepherdMetadata.migrationImage) {
                imageDependencies[imageMetaData.shepherdMetadata.migrationImage] = splitDockerImageTag(
                  imageMetaData.shepherdMetadata.migrationImage
                )
              }
              return imageMetaData
            }

            let infrastructureLoader = function(infrastructureImages: TInfrastructureImageMap) {
              return new Promise(function(resolve, reject) {
                resolve(
                  Object.entries(infrastructureImages as TInfrastructureImageMap).map(function([
                    herdKey,
                    herdDefinition,
                  ]) {
                    herdDefinition.herdKey = herdKey
                    return loadImageMetadata(herdDefinition)
                      .then(calculateDeploymentPlan)
                      .catch(function(e: Error) {
                        reject(new Error("When processing " + herdKey + ": " + e + (e.stack ? e.stack : "")))
                      })
                  })
                )
              })
            }

            infrastructurePromises.push(
              infrastructureLoader(herd.infrastructure || {})
                .then(function(addedPromises: Array<Promise<any>>) {
                  return Bluebird.all(addedPromises).catch(reject)
                })
                .catch(reject)
            )

            let loaders: TLoaderMap = {
              folders: async function(
                folders: THerdFolderMap
              ): Promise<Array<Promise<Array<TK8sDirDeploymentAction>>>> {
                let result: Promise<TK8sDirDeploymentAction[]>[] = Object.entries(folders).flatMap(function([
                  herdFolderName,
                  herdSpec,
                ]: [string, TFolderHerdSpec]) {
                  herdSpec.key = herdFolderName

                  return calculateFoldersPlan(imagesPath, herdSpec)
                    .then(function(plans: TK8sDirDeploymentAction[]) {
                      let allActionsInFolder = Bluebird.each(plans, function(
                        tk8sDirDeploymentAction: TK8sDirDeploymentAction
                      ) {
                        tk8sDirDeploymentAction.herdKey = `${herdSpec.key} - ${tk8sDirDeploymentAction.origin}`
                        tk8sDirDeploymentAction.herdSpec = herdSpec
                        // tk8sDirDeploymentAction.metadata = {
                        //   displayName: 'BULLSHIT',
                        //   semanticVersion: "0",
                        //   deploymentType: TDeploymentType.Kubernetes,
                        //   buildDate: new Date(0).toISOString(), // Might make sense to extract change timestamp on file from filesystem or git
                        //   hyperlinks: [],
                        // }
                        return releasePlan.addDeployment(tk8sDirDeploymentAction)
                      })
                      return allActionsInFolder
                    })
                    .catch(function(e) {
                      throw new Error("When processing folder " + herdFolderName + "\n" + e + (e.stack ? e.stack : ""))
                    })
                })
                return result
              },
              images: async function(
                images: TImageMap
              ): Promise<Array<Promise<Array<TDockerDeploymentAction | TK8sDockerImageDeploymentAction>>>> {
                let imageDeploymentPlans: Array<Promise<
                  Array<TDockerDeploymentAction | TK8sDockerImageDeploymentAction>
                >> = Object.entries(images).map(function([imgName, herdSpec]: [string, TDockerImageHerdSpec]) {
                  herdSpec.key = imgName
                  logger.debug("Deployment image - loading image meta data for docker image", JSON.stringify(herdSpec))

                  if (!herdSpec.image && herdSpec.dockerImage) {
                    Object.assign(herdSpec, splitDockerImageTag(herdSpec.dockerImage))
                  }
                  let promise: Promise<Array<TDockerDeploymentAction | TK8sDockerImageDeploymentAction>> = loadImageMetadata(herdSpec)
                    .then(getShepherdMetadata)
                    .then(addMigrationImageToDependenciesPlan) /// This is pretty ugly, adding to external structure sideffect
                    .then(calculateDeploymentPlan)
                    .then(function(imageDeploymentActions: Array<TAnyDeploymentAction>) {
                      return Bluebird.each(imageDeploymentActions, releasePlan.addDeployment) /// Fugly, sideffect to add to releasePlan here
                    })
                    .catch(function(e: Error | string) {
                      let errorMessage: string
                      if (typeof e === "string") {
                        console.error("Thrown error of type STRING!")
                        console.error(e)
                        errorMessage = e
                      } else {
                        errorMessage = "When processing image " + imgName + "\n" + e.message + (e.stack ? e.stack : "")
                      }
                      throw new Error(errorMessage)
                    })
                  return promise
                })
                return imageDeploymentPlans
              },
            }

            Promise.resolve({}).then(function() {
              Object.entries(herd).forEach(([herdType, herderDefinition]: [string, OmitKey<TDockerImageHerdSpec>]) => {
                if (loaders[herdType]) {
                  let loader: TLoaderFunction = loaders[herdType]
                  allPlanningPromises.push(
                    loader(herderDefinition).then(function(addedPromises) {
                      return Promise.all(addedPromises).catch(function(e) {
                        reject(e)
                      })
                    })
                  )
                } else {
                  // throw new Error('No loader registered for type ' + herdType)
                }
              })

              // Resolve all deployment definitions asynchronously
              Bluebird.all(allPlanningPromises)
                .then(function(_deploymentActions) {
                  return loaders["images"](imageDependencies).then(function(planPromises) {
                    return Bluebird.all(planPromises).catch(function(e) {
                      reject(e)
                    })
                  })
                })
                .then(function() {
                  resolve(releasePlan)
                })
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
