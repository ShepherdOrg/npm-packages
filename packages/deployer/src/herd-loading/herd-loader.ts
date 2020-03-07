import * as fs from "fs"

import {
  IDeploymentOrchestration,
  ILog,
  THerdFileStructure,
  THerdSectionDeclaration,
  THerdSectionType,
} from "../deployment-types"
import { getDockerRegistryClientsFromConfig, imageLabelsLoader } from "@shepherdorg/docker-image-metadata-loader"
import { TFeatureDeploymentConfig } from "../triggered-deployment/create-upstream-trigger-deployment-config"
import { TFileSystemPath } from "../helpers/basic-types"
import { IPlanFolderDeployments } from "./folder-loader/create-folder-deployment-planner"
import * as path from "path"
import { createImagesLoader } from "./image-loader/images-loader"
import { flatMapPolyfill } from "./folder-loader/flatmap-polyfill"
import { IDeploymentPlan, IDeploymentPlanFactory } from "../deployment-plan/deployment-plan"
import { IReleaseStateStore } from "@shepherdorg/state-store"
import { createKubectlDeploymentActionsFactory } from "../deployment-actions/kubectl-action/kubectl-deployment-action-factory"

const YAML = require("js-yaml")

flatMapPolyfill()

export type TDockerMetadataLoader = {
  imageLabelsLoader: typeof imageLabelsLoader
  getDockerRegistryClientsFromConfig: typeof getDockerRegistryClientsFromConfig
}

export type THerdLoaderDependencies = {
  deploymentOrchestration: IDeploymentOrchestration
  planFactory: IDeploymentPlanFactory
  logger: ILog
  featureDeploymentConfig: TFeatureDeploymentConfig
  exec: any
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
    exec: injected.exec,
  })

  async function loadHerd(fileName: TFileSystemPath): Promise<IDeploymentOrchestration> {
    if (fs.existsSync(fileName)) {
      let deploymentOrchestration = injected.deploymentOrchestration

      let herd: THerdFileStructure
      if (featureDeploymentConfig.isUpstreamFeatureDeployment()) {
        herd = featureDeploymentConfig.asHerd()
      } else {
        herd = YAML.load(fs.readFileSync(fileName, "utf8"))
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
            await loadHerdDeclarations(herdSectionDeclaration, herdDeclaration, herdFilePath).then(plans => {
              return Promise.all(plans.map(deploymentOrchestration.addDeploymentPlan))
            })
          } else {
            throw new Error("No loader registered for type " + herdDeclarationType + JSON.stringify(herdDeclaration))
          }
        })
      )
      return deploymentOrchestration
    } else {
      throw new Error(fileName + " does not exist!")
    }
  }

  return {
    loadHerd,
  }
}
