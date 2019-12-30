import * as fs from "fs"
import { emptyArray } from "../helpers/ts-functions"

import { FReleasePlanner, ILog, TAnyDeploymentAction, THerdFileStructure, TReleasePlan } from "./deployment-types"
import { getDockerRegistryClientsFromConfig, imageLabelsLoader } from "@shepherdorg/docker-image-metadata-loader"
import { TFeatureDeploymentConfig } from "./create-upstream-trigger-deployment-config"
import { TFileSystemPath } from "../basic-types"
import { FolderLoader } from "./folder-loader/folder-loader"
import * as path from "path"
import { ImagesLoader } from "./image-loader/images-loader"

const YAML = require("js-yaml")

import Bluebird = require("bluebird")

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

export type FHerdDeclarationLoader = (arg: any, imagesPath: string) => Promise<Array<TAnyDeploymentAction>>

export type TLoaderMap = { [herdType: string]: FHerdDeclarationLoader }

export interface THerdLoader {
  loadHerd(herdFilePath: TFileSystemPath, environment?: string ): Promise<TReleasePlan>
}


export function HerdLoader(injected: THerdLoaderDependencies): THerdLoader {
  const ReleasePlan = injected.ReleasePlan

  const featureDeploymentConfig = injected.featureDeploymentConfig
  const logger = injected.logger
  let folderLoader = FolderLoader({logger})

  const dockerRegistries = injected.labelsLoader.getDockerRegistryClientsFromConfig()

  const imageLabelsLoader = injected.labelsLoader.imageLabelsLoader({ dockerRegistries: dockerRegistries, logger: logger })
  let imagesLoaderObj = ImagesLoader({logger, imageLabelsLoader})

  async function loadHerd(fileName:TFileSystemPath, environment: string) : Promise<TReleasePlan> {
    return new Promise(function(resolve, reject) {
      try {
        if (fs.existsSync(fileName)) {
          let releasePlan = ReleasePlan(environment)

          let declaredPlannedActionPromises = emptyArray<Promise<Array<TAnyDeploymentAction>>>()

          let herd: THerdFileStructure
          if (featureDeploymentConfig.isUpstreamFeatureDeployment()) {
            herd = featureDeploymentConfig.asHerd()
          } else {
            herd = YAML.load(fs.readFileSync(fileName, "utf8"))
          }

          let loaders: TLoaderMap = {
            infrastructure: imagesLoaderObj.imagesLoader,
            folders: folderLoader.foldersLoader,
            images: imagesLoaderObj.imagesLoader,
          }

          const herdFilePath = path.dirname(fileName)
          Object.entries(herd).forEach(([herdDeclarationType, herdDeclaration]) => {
            if (loaders[herdDeclarationType]) {
              let loadHerdDeclarations: FHerdDeclarationLoader = loaders[herdDeclarationType]
              declaredPlannedActionPromises.push(
                loadHerdDeclarations(herdDeclaration, herdFilePath )
              )
            } else {
              throw new Error('No loader registered for type ' + herdDeclarationType + JSON.stringify(herdDeclaration))
            }
          })

          Bluebird.all(declaredPlannedActionPromises).then(async (deploymentActions)=>{
            return deploymentActions.flatMap((allActions)=>{
              return allActions.map((deploymentAction)=>{
                return releasePlan.addDeployment(deploymentAction)
              })
            })
          }).then(Bluebird.all).then((_addedActions)=>{
            // All add deployment actions should be resolved
            resolve( releasePlan)
          }).catch(reject)

        } else {
          reject(new Error(fileName + " does not exist!"))
        }
      } catch (e) {
        reject(e)
      }
    })
  }

  return {
    loadHerd
  }
}
