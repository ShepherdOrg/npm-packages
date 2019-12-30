import { ILog, TFolderHerdSpec, TFolderHerdSpecs, TK8sDirDeploymentAction } from "../deployment-types"
import { planFolderDeployment } from "../kubectl-deployer/folder-deployment-planner"
import { identityMap, TFileSystemPath } from "../../basic-types"
import * as path from "path"
import Bluebird = require("bluebird")
import { kubeSupportedExtensions } from "../kubectl-deployer/kube-supported-extensions"

interface TFolderLoaderDependencies {
  logger: ILog
}

export function FolderLoader(folderLoaderDependencies: TFolderLoaderDependencies){

  const logger = folderLoaderDependencies.logger
  async function foldersLoader(folders: TFolderHerdSpecs, imagesPath: string): Promise<Array<TK8sDirDeploymentAction>> {
    let arrayOfPromises: Array<Promise<Array<TK8sDirDeploymentAction>>> = Object.entries(folders).flatMap(function([
                                                             herdFolderName,
                                                             herdSpec,
                                                           ]: [string, TFolderHerdSpec]) {
      herdSpec.key = herdFolderName

      const folderPlanner = planFolderDeployment({
        kubeSupportedExtensions: kubeSupportedExtensions,
        logger,
      })

      function calculateFoldersPlan(herdFilePath: TFileSystemPath, herdFolder: TFolderHerdSpec) {
        let resolvedPath = path.resolve(herdFilePath, herdFolder.path)

        logger.info(`Scanning ${resolvedPath} for kubernetes deployment documents`)

        return folderPlanner.scanDir(resolvedPath, herdFolder)
      }

      return calculateFoldersPlan(imagesPath, herdSpec)
        .then(function(plans: TK8sDirDeploymentAction[]) {
          let allActionsInFolder = Bluebird.each(plans, function(
            tk8sDirDeploymentAction: TK8sDirDeploymentAction,
          ) {
            tk8sDirDeploymentAction.herdKey = `${herdSpec.key} - ${tk8sDirDeploymentAction.origin}`
            tk8sDirDeploymentAction.herdSpec = herdSpec
            return tk8sDirDeploymentAction
          })
          return allActionsInFolder
        })
        .catch(function(e) {
          throw new Error("When processing folder " + herdFolderName + "\n" + e + (e.stack ? e.stack : ""))
        })
    })

    let folderDeploymentActions: Array<Array<TK8sDirDeploymentAction>>  = await Bluebird.all(arrayOfPromises)

    return folderDeploymentActions.flatMap((array)=> array.map(identityMap))
  }

  return {
    foldersLoader: foldersLoader
  }
}
