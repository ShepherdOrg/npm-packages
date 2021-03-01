import * as fs from "fs"

import {
  TDockerImageHerdDeclarations,
  THerdFileStructure,
  THerdSectionDeclaration,
  THerdSectionType,
} from "../deployment-types"
import { getDockerRegistryClientsFromConfig, imageLabelsLoader } from "@shepherdorg/docker-image-metadata-loader"
import { IConfigureUpstreamDeployment } from "../triggered-deployment/create-upstream-trigger-deployment-config"
import { TFileSystemPath } from "../helpers/basic-types"
import { IPlanFolderDeployments } from "./folder-loader/create-folder-deployment-planner"
import * as path from "path"
import { createImagesLoader } from "./image-loader/images-loader"
import { flatMapPolyfill } from "./folder-loader/flatmap-polyfill"
import { IDeploymentPlan, IDeploymentPlanFactory } from "../deployment-plan/deployment-plan"
import { IReleaseStateStore } from "@shepherdorg/state-store"
import { IDeploymentOrchestration } from "../deployment-orchestration/deployment-orchestration"
import { ILog } from "../logging/logger"
import * as chalk from "chalk"
import * as yaml from "js-yaml"
import { FExec } from "@shepherdorg/ts-exec"

flatMapPolyfill()

export type TDockerMetadataLoader = {
  imageLabelsLoader: typeof imageLabelsLoader
  getDockerRegistryClientsFromConfig: typeof getDockerRegistryClientsFromConfig
}

export type THerdLoaderDependencies = {
  deploymentOrchestration: IDeploymentOrchestration
  planFactory: IDeploymentPlanFactory
  logger: ILog
  featureDeploymentConfig: IConfigureUpstreamDeployment
  exec: FExec
  labelsLoader: TDockerMetadataLoader
  stateStore: IReleaseStateStore
  folderLoader: IPlanFolderDeployments
}

export type FHerdDeclarationLoader = (
  herdSectionDeclaration: THerdSectionDeclaration,
  arg: any,
  imagesPath: string
) => Promise<Array<IDeploymentPlan>>

export type TLoaderMap = { [herdType: string]: FHerdDeclarationLoader }

export interface THerdLoader {
  loadHerd(herdFilePath: TFileSystemPath): Promise<IDeploymentOrchestration>
}

export function createHerdLoader(injected: THerdLoaderDependencies): THerdLoader {
  const featureDeploymentConfig = injected.featureDeploymentConfig
  const logger = injected.logger

  const dockerRegistries = injected.labelsLoader.getDockerRegistryClientsFromConfig()

  const imageLabelsLoader = injected.labelsLoader.imageLabelsLoader({
    dockerRegistries: dockerRegistries,
    logger: logger,
  })
  const imagesLoaderObj = createImagesLoader({
    logger,
    imageLabelsLoader,
    planFactory: injected.planFactory,
    stateStore: injected.stateStore,
  })

  async function loadHerd(fileName: TFileSystemPath): Promise<IDeploymentOrchestration> {
    if (fs.existsSync(fileName)) {
      let deploymentOrchestration = injected.deploymentOrchestration

      let herd: THerdFileStructure
      if (path.basename(fileName) === "shepherd.json") {
        console.log(
          `WARNING: Single-deployment deployment is work in progress. Need to finish versionist package for this to work.`
        )
        let localImageDef: TDockerImageHerdDeclarations = {
          localImage: {
            image: "string",
            imagetag: "string",
          },
        }
        herd = {
          images: localImageDef,
        }
      } else if (featureDeploymentConfig.isUpstreamTriggeredDeployment()) {
        herd = featureDeploymentConfig.asHerd()
      } else {
        herd = yaml.load(fs.readFileSync(fileName, "utf8"))
      }

      let loaders: TLoaderMap = {
        infrastructure: imagesLoaderObj.imagesLoader,
        folders: injected.folderLoader.foldersLoader,
        images: imagesLoaderObj.imagesLoader,
      }

      const herdFilePath = path.dirname(fileName)

      await Promise.all(
        Object.entries(herd).map(async ([herdDeclarationType, herdDeclaration], idx) => {
          const herdSectionDeclaration: THerdSectionDeclaration = {
            herdSectionIndex: idx,
            herdSectionType: herdDeclarationType as THerdSectionType,
          }
          if (loaders[herdDeclarationType]) {
            let loadHerdDeclarations: FHerdDeclarationLoader = loaders[herdDeclarationType] // folders, infrastructure, or images
            return loadHerdDeclarations(herdSectionDeclaration, herdDeclaration, herdFilePath).then(
              (plans: Array<IDeploymentPlan>) => {
                return Promise.all(plans.map(deploymentOrchestration.addDeploymentPlan))
              }
            )
          } else {
            throw new Error(
              "No loader registered for type " + chalk.red(herdDeclarationType) + JSON.stringify(herdDeclaration)
            )
          }
        })
      )
      return deploymentOrchestration
    } else {
      throw new Error(chalk.red(fileName) + " does not exist!")
    }
  }

  return {
    loadHerd,
  }
}
