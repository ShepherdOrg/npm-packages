import {
  IAnyDeploymentAction,
  IExecutableAction,
  IKubectlDeployAction,
  ILog,
  isDockerDeploymentAction,
  isKubectlDeployAction,
  TActionExecutionOptions,
  THerdDeclaration, TRollbackResult,
} from "../deployment-types"
import { IReleaseStateStore, TDeploymentStateParams } from "@shepherdorg/state-store"
import { emptyArray } from "../helpers/ts-functions"
import {
  createRolloutWaitActionFactory,
  ICreateRolloutWaitActions,
} from "../deployment-actions/kubectl-action/rollout-wait-action-factory"
import { mapUntypedDeploymentData } from "../ui-mapping/map-untyped-deployment-data"
import { TFileSystemPath } from "../helpers/basic-types"
import * as path from "path"
import { writeFile } from "../helpers/promisified"
import { IPushToShepherdUI } from "../shepherd"

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
  rolloutWaitActionFactory: ICreateRolloutWaitActions
}

export interface IDeploymentPlanFactory {
  createDeploymentPlan: (herdSpec: THerdDeclaration) => IDeploymentPlan
}


export function DeploymentPlanFactory(injected: TDeploymentPlanDependencies ): IDeploymentPlanFactory {

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

    let planInstance : IDeploymentPlan = {
      async execute(executionOptions: TActionExecutionOptions): Promise<IDeploymentPlanExecutionResult> {
        let executionPromise = deploymentActions.reduce((p, nextAction) => {
          return p.then((remainingActions) => {
            return nextAction.execute(executionOptions).then(async (actionResult) => {
              remainingActions.push(actionResult)
              if(!executionOptions.dryRun && executionOptions.pushToUi){
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
        if(action.isStateful){
          action.state = await injected.stateStore.getDeploymentState(action as unknown as TDeploymentStateParams)
        }

        deploymentActions.push(action)

        if (isKubectlDeployAction(action)) {
          await addRolloutWaitActions(action)
        }
      },
      async exportActions(exportDirectory: TFileSystemPath){
          await Promise.all(deploymentActions.map(function(action: IAnyDeploymentAction) {
            if(isDockerDeploymentAction(action)){

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
            } else if (isKubectlDeployAction( action)) {
              let writePath = path.join(
                exportDirectory,
                action.operation + "-" + action.identifier.toLowerCase() + ".yaml",
              )
              return writeFile(writePath, action.descriptor.trim())
            } // else its a followup action, such as rollout status or e2e test, which we do not export
          })).then(()=>{
            injected.logger.debug(`Exported ${deploymentActions.length} actions to ${exportDirectory} from ${herdDeclaration.key}`)
          })
      },
      printPlan(logger: ILog) : boolean {
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
            } else if(modified) {
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

  return {
    createDeploymentPlan,
  }
}

