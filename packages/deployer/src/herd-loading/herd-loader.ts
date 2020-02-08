import * as fs from "fs"
import { emptyArray } from "../helpers/ts-functions"

import {
  FDeploymentOrchestrationConstructor,
  ILog,
  IAnyDeploymentAction,
  THerdFileStructure,
  THerdSectionDeclaration, THerdSectionType,
  TDeploymentOrchestration,
} from "../deployment-types"
import { getDockerRegistryClientsFromConfig, imageLabelsLoader } from "@shepherdorg/docker-image-metadata-loader"
import { TFeatureDeploymentConfig } from "../triggered-deployment/create-upstream-trigger-deployment-config"
import { TFileSystemPath } from "../helpers/basic-types"
import { FolderLoader } from "./folder-loader/folder-loader"
import * as path from "path"
import { ImagesLoader } from "./image-loader/images-loader"

const YAML = require("js-yaml")

import Bluebird = require("bluebird")
import { flatMapPolyfill } from "./folder-loader/flatmap-polyfill"

flatMapPolyfill()

export type TDockerMetadataLoader = {
  imageLabelsLoader: typeof imageLabelsLoader
  getDockerRegistryClientsFromConfig: typeof getDockerRegistryClientsFromConfig
}

export type THerdLoaderDependencies = {
  logger: ILog
  featureDeploymentConfig: TFeatureDeploymentConfig
  ReleasePlan: FDeploymentOrchestrationConstructor
  exec: any
  labelsLoader: TDockerMetadataLoader
}

// TODO Return a deployment plan instead of an array of IAnyDeploymentAction
export type FHerdDeclarationLoader = (herdSectionDeclaration: THerdSectionDeclaration, arg: any, imagesPath: string) => Promise<Array<IAnyDeploymentAction>>

export type TLoaderMap = { [herdType: string]: FHerdDeclarationLoader }

export interface THerdLoader {
  loadHerd(herdFilePath: TFileSystemPath, environment?: string ): Promise<TDeploymentOrchestration>
}


export function HerdLoader(injected: THerdLoaderDependencies): THerdLoader {
  const ReleasePlan = injected.ReleasePlan

  const featureDeploymentConfig = injected.featureDeploymentConfig
  const logger = injected.logger
  let folderLoader = FolderLoader({logger})

  const dockerRegistries = injected.labelsLoader.getDockerRegistryClientsFromConfig()

  const imageLabelsLoader = injected.labelsLoader.imageLabelsLoader({ dockerRegistries: dockerRegistries, logger: logger })
  let imagesLoaderObj = ImagesLoader({logger, imageLabelsLoader})

  async function loadHerd(fileName:TFileSystemPath, environment: string) : Promise<TDeploymentOrchestration> {
    return new Promise(function(resolve, reject) {
      try {
        if (fs.existsSync(fileName)) {
          let releasePlan = ReleasePlan(environment)

          let plannedActionPromises = emptyArray<Promise<Array<IAnyDeploymentAction>>>()

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
          Object.entries(herd).forEach(([herdDeclarationType, herdDeclaration], idx) => {
            const herdSectionDeclaration:THerdSectionDeclaration = {
              herdSectionIndex: idx, herdSectionType: herdDeclarationType as THerdSectionType

            }
            if (loaders[herdDeclarationType]) {
              let loadHerdDeclarations: FHerdDeclarationLoader = loaders[herdDeclarationType]
              // TODO Here I want to create a deployment plan instead of an array of deployment actions.
              // deploymentPlans.push....
              plannedActionPromises.push(
                loadHerdDeclarations(herdSectionDeclaration, herdDeclaration, herdFilePath )
              )
            } else {
              throw new Error('No loader registered for type ' + herdDeclarationType + JSON.stringify(herdDeclaration))
            }
          })

          Bluebird.all(plannedActionPromises).then(async (deploymentActions)=>{
            return deploymentActions.flatMap((allActions)=>{
              return allActions.map((deploymentAction)=>{
                return releasePlan.addDeploymentAction(deploymentAction)
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
