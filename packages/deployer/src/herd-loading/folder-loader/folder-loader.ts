import {
  IK8sDirDeploymentAction,
  ILog,
  TFolderHerdDeclaration,
  TFolderHerdSpecs,
  THerdSectionDeclaration,
} from "../../deployment-types"
import { planFolderDeployment } from "./folder-deployment-planner"
import { identityMap, TFileSystemPath } from "../../helpers/basic-types"
import * as path from "path"
import { kubeSupportedExtensions } from "../../deployment-actions/kubectl-deployer/kube-supported-extensions"
import { flatMapPolyfill } from "./flatmap-polyfill"
import Bluebird = require("bluebird")

flatMapPolyfill()

interface TFolderLoaderDependencies {
  logger: ILog
}

export function FolderLoader(folderLoaderDependencies: TFolderLoaderDependencies){

  const logger = folderLoaderDependencies.logger
  async function foldersLoader(sectionDeclaration: THerdSectionDeclaration, folders: TFolderHerdSpecs, imagesPath: string): Promise<Array<IK8sDirDeploymentAction>> {
    let arrayOfPromises: Array<Promise<Array<IK8sDirDeploymentAction>>> = Object.entries(folders).flatMap(function([
                                                             herdFolderName,
                                                             herdSpec,
                                                           ]: [string, TFolderHerdDeclaration]) {
      herdSpec.key = herdFolderName

      const folderPlanner = planFolderDeployment({
        kubeSupportedExtensions: kubeSupportedExtensions,
        logger,
      })

      function calculateFoldersPlan(herdFilePath: TFileSystemPath, herdFolder: TFolderHerdDeclaration) {
        let resolvedPath = path.resolve(herdFilePath, herdFolder.path)

        logger.info(`Scanning ${resolvedPath} for kubernetes deployment documents`)

        return folderPlanner.scanDir(resolvedPath, herdFolder)
      }

      return calculateFoldersPlan(imagesPath, herdSpec)
        .then(function(plans: IK8sDirDeploymentAction[]) {
          let allActionsInFolder = Bluebird.each(plans, function(
            tk8sDirDeploymentAction: IK8sDirDeploymentAction,
          ) {
            tk8sDirDeploymentAction.herdKey = `${herdSpec.key} - ${tk8sDirDeploymentAction.origin}`
            tk8sDirDeploymentAction.herdDeclaration = {sectionDeclaration: sectionDeclaration, ...herdSpec}
            return tk8sDirDeploymentAction
          })
          return allActionsInFolder
        })
        .catch(function(e) {
          throw new Error("When processing folder " + herdFolderName + "\n" + e + (e.stack ? e.stack : ""))
        })
    })

    let folderDeploymentActions: Array<Array<IK8sDirDeploymentAction>>  = await Bluebird.all(arrayOfPromises)

    return folderDeploymentActions.flatMap((array)=> array.map(identityMap))
  }

  return {
    foldersLoader: foldersLoader
  }
}
