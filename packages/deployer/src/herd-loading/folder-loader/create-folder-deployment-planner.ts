import {
  IK8sDirDeploymentAction,
  TFolderHerdDeclaration,
  TFolderHerdDeclarations,
  THerdSectionDeclaration,
} from "../../deployment-types"
import { ICreateKubectlActionsForFolderStructure } from "./folder-action-factory"
import { TFileSystemPath } from "../../helpers/basic-types"
import * as path from "path"
import { flatMapPolyfill } from "./flatmap-polyfill"
import { IDeploymentPlan, IDeploymentPlanFactory } from "../../deployment-plan/deployment-plan"
import { newProgrammerOops } from "oops-error"
import Bluebird = require("bluebird")
import { ILog } from "@shepherdorg/logger"
import * as chalk from "chalk"

flatMapPolyfill()

export type TFolderPlannerDependencies = {
  logger: ILog
  planFactory: IDeploymentPlanFactory
  folderActionFactory: ICreateKubectlActionsForFolderStructure
}

export interface IPlanFolderDeployments {
  foldersLoader: (
    sectionDeclaration: THerdSectionDeclaration,
    folders: TFolderHerdDeclarations,
    imagesPath: string
  ) => Promise<Array<IDeploymentPlan>>
}

export function createFolderDeploymentPlanner(injected: TFolderPlannerDependencies): IPlanFolderDeployments {
  const logger = injected.logger

  async function foldersLoader(
    sectionDeclaration: THerdSectionDeclaration,
    folders: TFolderHerdDeclarations,
    imagesPath: string
  ): Promise<Array<IDeploymentPlan>> {
    let arrayOfPromises: Array<Promise<Array<IK8sDirDeploymentAction>>> = Object.entries(folders).flatMap(function([
      herdFolderName,
      herdSpec,
    ]: [string, TFolderHerdDeclaration]) {
      herdSpec.key = herdFolderName

      const folderActionFactory = injected.folderActionFactory

      function calculateFoldersPlan(herdFilePath: TFileSystemPath, herdFolder: TFolderHerdDeclaration) {
        let resolvedPath = path.resolve(herdFilePath, herdFolder.path)

        logger.info(`Scanning ${resolvedPath} for kubernetes deployment documents`)

        return folderActionFactory.scanDir(resolvedPath, herdFolder)
      }

      return calculateFoldersPlan(imagesPath, herdSpec)
        .then(function(plans: IK8sDirDeploymentAction[]) {
          return Bluebird.each(plans, function(tk8sDirDeploymentAction: IK8sDirDeploymentAction) {
            tk8sDirDeploymentAction.herdKey = `${herdSpec.key} - ${tk8sDirDeploymentAction.origin}`
            tk8sDirDeploymentAction.herdDeclaration = { sectionDeclaration: sectionDeclaration, ...herdSpec }
            return tk8sDirDeploymentAction
          })
        })
        .catch(function(e) {
          console.log(`Caught error, calculating folders plan`)
          throw new Error(`When processing folder ${chalk.red(herdFolderName)}
${e.message ? e.message : ""}`)
        })
    })

    let folderDeploymentActions: Array<Array<IK8sDirDeploymentAction>> = await Bluebird.all(arrayOfPromises)

    return await Promise.all(
      folderDeploymentActions.flatMap(async folderDeploymentActions => {
        if (folderDeploymentActions.length === 0) {
          throw newProgrammerOops("Zero actions loaded from herd section spec", folderDeploymentActions)
        }

        const plan = injected.planFactory.createDeploymentPlan(folderDeploymentActions[0].herdDeclaration)
        await Promise.all(folderDeploymentActions.map(plan.addAction))
        return plan
      })
    )
  }

  return {
    foldersLoader: foldersLoader,
  }
}
