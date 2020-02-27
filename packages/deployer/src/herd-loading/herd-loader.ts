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
import { createFolderLoader } from "./folder-loader/folder-loader"
import * as path from "path"
import { createImagesLoader } from "./image-loader/images-loader"
import { flatMapPolyfill } from "./folder-loader/flatmap-polyfill"
import { IDeploymentPlan, IDeploymentPlanFactory } from "../deployment-plan/deployment-plan"
import { IReleaseStateStore } from "@shepherdorg/state-store"
import { createKubectlDeploymentActionsFactory } from "../deployment-actions/kubectl-action/kubectl-deployment-action-factory"
import { createDeploymentTestActionFactory } from "./image-loader/deployment-test-action"
import { createDockerActionFactory } from "../deployment-actions/docker-action/docker-action"

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
}

export type FHerdDeclarationLoader = (
  herdSectionDeclaration: THerdSectionDeclaration,
  arg: any,
  imagesPath: string
) => Promise<Array<IDeploymentPlan>>

export type TLoaderMap = { [herdType: string]: FHerdDeclarationLoader }

export interface THerdLoader {
  loadHerd(herdFilePath: TFileSystemPath, environment?: string): Promise<IDeploymentOrchestration>
}

export function createHerdLoader(injected: THerdLoaderDependencies): THerdLoader {
  const featureDeploymentConfig = injected.featureDeploymentConfig
  const logger = injected.logger

  const kubectlDeploymentActionFactory = createKubectlDeploymentActionsFactory({
    exec: injected.exec,
    logger: injected.logger,
    stateStore: injected.stateStore
  })
  const folderLoader = createFolderLoader({ logger, planFactory: injected.planFactory }, kubectlDeploymentActionFactory)

  const dockerRegistries = injected.labelsLoader.getDockerRegistryClientsFromConfig()

  const imageLabelsLoader = injected.labelsLoader.imageLabelsLoader({
    dockerRegistries: dockerRegistries,
    logger: logger,
  })
  const dockerActionFactory = createDockerActionFactory({
    exec: injected.exec,
    logger: injected.logger,
    stateStore: injected.stateStore
  })
  const imagesLoaderObj = createImagesLoader({
    logger,
    imageLabelsLoader,
    planFactory: injected.planFactory,
    stateStore: injected.stateStore,
    exec: injected.exec
  } )

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
        folders: folderLoader.foldersLoader,
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
