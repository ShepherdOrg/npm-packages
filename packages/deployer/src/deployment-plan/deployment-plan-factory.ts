import {
  IAnyDeploymentAction,
  IExecutableAction,
  IKubectlDeployAction,
  ILog,
  isDockerDeploymentAction,
  isKubectlDeployAction,
  TActionExecutionOptions,
  THerdDeclaration,
  TImageInformation,
  TRollbackResult,
} from "../deployment-types"
import { IReleaseStateStore, TDeploymentStateParams } from "@shepherdorg/state-store"
import { emptyArray } from "../helpers/ts-functions"
import { ICreateRolloutWaitActions } from "../deployment-actions/kubectl-action/rollout-wait-action-factory"
import { mapUntypedDeploymentData } from "../ui-mapping/map-untyped-deployment-data"
import { TFileSystemPath } from "../helpers/basic-types"
import * as path from "path"
import { writeFile } from "../helpers/promisified"
import { IPushToShepherdUI } from "../shepherd"
import { ICreateDeploymentTestAction, IRollbackDeployment } from "../herd-loading/image-loader/deployment-test-action"
import { ICreateDockerDeploymentActions } from "../deployment-actions/docker-action/create-docker-deployment-action"
import { ICreateDockerImageKubectlDeploymentActions } from "../deployment-actions/kubectl-action/create-docker-kubectl-deployment-actions"
import { newProgrammerOops } from "oops-error"

export interface IDeploymentPlanExecutionResult {
  actionResults: IExecutableAction[]
}

export interface IDeploymentPlan {
  herdKey: string,
  herdDeclaration: THerdDeclaration,
  deploymentActions: Array<IExecutableAction>

  addAction(action: IExecutableAction): Promise<void>

  execute(deploymentOptions: TActionExecutionOptions): Promise<IDeploymentPlanExecutionResult>

  /**
   * Returns false if there is nothing planned, true otherwise
   * */
  printPlan(logger: ILog): boolean

  exportActions(_exportDirectory: TFileSystemPath): Promise<void>
}

export type TK8sDeploymentPlansByKey = { [herdKey: string]: string }

/* TODO : Need to consider whether to make deployment plans fail/succeed independently. Currently the first one that
*   fails will stop all deployment. */

export interface TDeploymentPlanDependencies {
  stateStore: IReleaseStateStore
  exec: any
  logger: ILog
  uiDataPusher: IPushToShepherdUI
  rolloutWaitActionFactory: ICreateRolloutWaitActions,
  dockerImageKubectlDeploymentActionFactory: ICreateDockerImageKubectlDeploymentActions
  deployerActionFactory: ICreateDockerDeploymentActions
  deploymentTestActionFactory: ICreateDeploymentTestAction
}

export interface IDeploymentPlanFactory {
  createDeploymentPlan: (herdSpec: THerdDeclaration) => IDeploymentPlan

  extractedCreateDepActions(imageInformation: TImageInformation): Promise<Array<IExecutableAction>>
  extractedCreateImageDeploymentPlan(imageInformation: TImageInformation): Promise<IDeploymentPlan>
}

export function DeploymentPlanFactory(injected: TDeploymentPlanDependencies): IDeploymentPlanFactory {

  function createDeploymentPlan(herdDeclaration: THerdDeclaration): IDeploymentPlan {
    const deploymentActions: Array<IExecutableAction> = []


    // TODO Map and push on IDeploymentPlan instead of actions
    async function mapDeploymentDataAndPush(deploymentData: IExecutableAction | undefined) {
      if (!deploymentData) {
        return deploymentData
      } else {
        const mappedData = mapUntypedDeploymentData(deploymentData as IAnyDeploymentAction)
        if (injected.uiDataPusher && deploymentData.isStateful) {
          await injected.uiDataPusher.pushDeploymentStateToUI(mappedData)
        }
        return deploymentData
      }
    }

    async function addRolloutWaitActions(kubectlDeployAction: IKubectlDeployAction) {

      if (kubectlDeployAction.deploymentRollouts && kubectlDeployAction.operation === "apply" && kubectlDeployAction.state?.modified) {
        await Promise.all(kubectlDeployAction.deploymentRollouts.map(async (deploymentRollout) => {
          await planInstance.addAction(injected.rolloutWaitActionFactory.RolloutWaitActionFactory(deploymentRollout))
        }, {}))
      }
    }

    let planInstance: IDeploymentPlan = {
      async execute(executionOptions: TActionExecutionOptions): Promise<IDeploymentPlanExecutionResult> {
        let executionPromise = deploymentActions.reduce((p, nextAction) => {
          return p.then((remainingActions) => {
            return nextAction.execute(executionOptions).then(async (actionResult) => {
              remainingActions.push(actionResult)
              if (!executionOptions.dryRun && executionOptions.pushToUi) {
                await mapDeploymentDataAndPush(nextAction)
              }
              return remainingActions
            })
          })
        }, Promise.resolve(emptyArray<IExecutableAction>()))
        let actionResults = await executionPromise

        return { actionResults }
      },
      async addAction(action: IExecutableAction): Promise<void> {
        injected.logger.debug(`Adding action to plan ${herdDeclaration.key} `, action.planString())
        // @ts-ignore
        // if(!action.version){
        //   console.log(`NO action version`, action.planString(), ' decriptor: ', action.descriptor)
        // }
        if (action.isStateful) {
          action.state = await injected.stateStore.getDeploymentState(action as unknown as TDeploymentStateParams)
        }

        deploymentActions.push(action)

        if (isKubectlDeployAction(action)) {
          await addRolloutWaitActions(action)
        }
      },
      async exportActions(exportDirectory: TFileSystemPath) {
        await Promise.all(deploymentActions.map(function(action: IAnyDeploymentAction) {
          if (isDockerDeploymentAction(action)) {

            if (!action.forTestParameters) {
              throw new Error("Missing forTestParameters!")
            }
            if (!action.imageWithoutTag) {
              throw new Error("Missing forTestParameters!")
            }
            let cmdLine = `docker run ${action.forTestParameters.join(" ")}`

            let writePath = path.join(
              exportDirectory,
              action.imageWithoutTag.replace(/\//g, "_") + "-deployer.txt",
            )
            return writeFile(writePath, cmdLine)
          } else if (isKubectlDeployAction(action)) {
            let writePath = path.join(
              exportDirectory,
              action.operation + "-" + action.identifier.toLowerCase() + ".yaml",
            )
            return writeFile(writePath, action.descriptor.trim())
          } // else its a followup action, such as rollout status or e2e test, which we do not export
        })).then(() => {
          injected.logger.debug(`Exported ${deploymentActions.length} actions to ${exportDirectory} from ${herdDeclaration.key}`)
        })
      },
      printPlan(logger: ILog): boolean {
        let modified = false

        deploymentActions.forEach(function(deploymentAction: IExecutableAction) {
          // Ok, so conflicting ideas. Get and store state only on stateful actions. Always creating rollout wait actions and test actions. Print all actions that are going to be performed.
          // ?? Add a reduction step reducing a) actions in plan to those executed and b) plans with executable actions?
          if (deploymentAction.isStateful && deploymentAction.state) {
            if (deploymentAction.state.modified) {
              if (!modified) {
                if (herdDeclaration) {
                  logger.info(`Deploying ${herdDeclaration.key}`)
                } else {
                  logger.info("Missing herdKey for ", planInstance)
                }
              }
              modified = true
              logger.info(`  - ${deploymentAction.planString()}`)
            } else if (modified) {
              logger.info(`  - ${deploymentAction.planString()}`)
            }
          }
        })
        return modified
      },
      herdKey: herdDeclaration.key,
      herdDeclaration,
      deploymentActions: deploymentActions,
    }
    return planInstance
  }

  async function extractedCreateDepActions(imageInformation: TImageInformation) {
    if (imageInformation.shepherdMetadata) {
      let resultingActions: Array<IExecutableAction> = emptyArray<IExecutableAction>()

      if (!imageInformation.imageDeclaration) {
        throw newProgrammerOops("Invalid image information, no image declaration!", imageInformation)
      }
      if (imageInformation.shepherdMetadata.preDeployTest) {
        resultingActions.push(injected.deploymentTestActionFactory.createDeploymentTestAction(imageInformation.shepherdMetadata.preDeployTest, imageInformation.shepherdMetadata))
      }
      let deploymentActions: Array<IExecutableAction>
      if (imageInformation.shepherdMetadata.deploymentType === "deployer") {
        deploymentActions = await injected.deployerActionFactory.createDockerDeploymentAction(imageInformation)
      } else if (imageInformation.shepherdMetadata.deploymentType === "k8s") {
        deploymentActions = await injected.dockerImageKubectlDeploymentActionFactory.createKubectlDeploymentActions(imageInformation)
        // TODO MUST TODO Move rollout wait action creation here to have in the correct execution order for the plan
      } else {
        throw new Error(`Unexpected: No planner in place for deploymentType ${imageInformation.shepherdMetadata.deploymentType} in ${imageInformation.shepherdMetadata.displayName} `)
      }
      resultingActions = resultingActions.concat(deploymentActions)

      if (imageInformation.shepherdMetadata.postDeployTest) {
        let deploymentActionsRollback: IRollbackDeployment = {
          async rollbackDeploymentPlan(): Promise<TRollbackResult> {
            let NO_ROLLBACK_RESULT = { code: 0 }
            return await Promise.all(deploymentActions.map(rollback => rollback.canRollbackExecution() && rollback.rollback() || NO_ROLLBACK_RESULT)).then(() => {
              return {}
            })
          },
        }
        resultingActions.push(injected.deploymentTestActionFactory.createDeploymentTestAction(imageInformation.shepherdMetadata.postDeployTest, imageInformation.shepherdMetadata, deploymentActionsRollback))
      }

      return resultingActions
    } else {
      throw new Error("No shepherd metadata present! Do not know what to do with " + JSON.stringify(imageInformation))
    }
  }

  async function extractedCreateImageDeploymentPlan(imageInformation: TImageInformation) {
    if (imageInformation.shepherdMetadata) {

      const resultingActions = await extractedCreateDepActions(imageInformation)
      const resultingPlan = createDeploymentPlan(imageInformation.imageDeclaration)
      await Promise.all(resultingActions.map(resultingPlan.addAction))

      return resultingPlan
    } else {
      throw new Error("No shepherd metadata present! Do not know what to do with " + JSON.stringify(imageInformation))
    }
  }


  return {
    createDeploymentPlan,
    extractedCreateDepActions,
    extractedCreateImageDeploymentPlan,
  }
}

