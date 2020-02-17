import {
  IAnyDeploymentAction,
  IDockerDeploymentAction,
  IExecutableAction, IK8sDirDeploymentAction, IK8sDockerImageDeploymentAction,
  IKubectlDeployAction,
  ILog,
  isKubectlDeployAction,
  TActionExecutionOptions,
} from "../deployment-types"
import { IReleaseStateStore, TDeploymentStateParams } from "@shepherdorg/state-store"
import { emptyArray } from "../helpers/ts-functions"
import { RolloutWaitActionFactory } from "../deployment-actions/kubectl-deployer/rollout-wait-action-factory"
import { Oops } from "oops-error"
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
  deploymentActions: Array<IExecutableAction>

  addAction(action: IExecutableAction): Promise<void>

  execute(deploymentOptions: TActionExecutionOptions): Promise<IDeploymentPlanExecutionResult>

  /**
   * Returns false if there is nothing planned, true otherwise
   * */
  printPlan(logger: ILog): boolean
}


export type TK8sDeploymentPlansByKey = { [herdKey: string]: string }

/* At present, CreateDeploymentPlan is only supporting the orchestration part, not the actual planning part.
* TODO : Move planning logic here (from image-deployment-planner), stop moving actions around and move deployment plans around instead.
*  How does rollback on failure? We need to mark the deployment as failed. Or do we? Keep the UI simple and only display successful builds
* there for now.
* Deployment state updated with deployment action. Create on-failure action which deploys last good version.
* Deployment action
* Execution order generally does not matter.
* Refactoring order:
*      Change all loaders to return IDeploymentPlan
*      Change orchestrator to accept and execute IDeploymentPlan
*      Rollout wait action creation should be in image loader. Refactor and rethink derivedDeployments in this context ( derived deploymentActions ?).
*         Derived deployments should go into deployment plan.
*      Probably: Change loader concept into IImageDeploymentPlanFactory, IFolderDeploymentPlanFactory
*      See what can be done about simplifying image data information passing around. Information hiding!
*  */

export interface TDeploymentPlanDependencies {
  stateStore: IReleaseStateStore
  cmd: any
  logger: ILog
  uiDataPusher: IPushToShepherdUI
}

export interface IDeploymentPlanFactory {
  createDeploymentPlan: (herdKey: string) => IDeploymentPlan
}


export function DeploymentPlanFactory(injected: TDeploymentPlanDependencies): IDeploymentPlanFactory {

  function createDeploymentPlan(herdKey: string): IDeploymentPlan {
    const deploymentActions: Array<IExecutableAction> = []


    // TODO Map and push on IDeploymentPlan instead of actions
    async function mapDeploymentDataAndPush(deploymentData: IExecutableAction | undefined) {
      if (!deploymentData) {
        return deploymentData
      } else {
        const mappedData = mapUntypedDeploymentData(deploymentData as IAnyDeploymentAction)
        if (injected.uiDataPusher && deploymentData.pushToUI) {
          await injected.uiDataPusher.pushDeploymentStateToUI(mappedData)
        }
        return deploymentData
      }
    }

    function mapDeploymentDataAndWriteTo(dryrunOutputDir: TFileSystemPath) {
      return async (deploymentData: IAnyDeploymentAction | undefined) => {
        if (!deploymentData) {
          return deploymentData
        } else {
          const mappedData = mapUntypedDeploymentData(deploymentData)
          if (mappedData) {
            const writePath = path.join(dryrunOutputDir, `send-to-ui-${mappedData?.deploymentState.key}.json`)
            await writeFile(writePath, JSON.stringify(deploymentData, null, 2))
            return deploymentData
          } else {
            return deploymentData
          }
        }
      }
    }


    async function addRolloutWaitActions(kubectlDeployAction: IKubectlDeployAction) {

      if (kubectlDeployAction.deploymentRollouts && kubectlDeployAction.operation === "apply" && kubectlDeployAction.state?.modified) {
        await Promise.all(kubectlDeployAction.deploymentRollouts.map(async (deploymentRollout) => {
          await planInstance.addAction(RolloutWaitActionFactory(deploymentRollout))
        }, {}))
      }
    }

    function saveDeploymentActionState(
      deployment: IExecutableAction,
    ) {
      if (!deployment.state) {
        throw new Oops({ message: "State is mandatory here", category: "ProgrammerError" })
      }
      return injected.stateStore.saveDeploymentState(deployment.state)
    }

    let planInstance = {
      async execute(executionOptions: TActionExecutionOptions): Promise<IDeploymentPlanExecutionResult> {
        let executionPromise = deploymentActions.reduce((p, nextAction) => {
          return p.then((remainingActions) => {
            return nextAction.execute(executionOptions, injected.cmd, injected.logger, saveDeploymentActionState).then((actionResult) => {
              remainingActions.push(actionResult)
              if(!executionOptions.dryRun && executionOptions.pushToUi){
                mapDeploymentDataAndPush(nextAction)
              }
              return remainingActions
            })
          })
        }, Promise.resolve(emptyArray<IExecutableAction>()))
        let actionResults = await executionPromise
        return { actionResults }

      },
      async addAction(action: IExecutableAction): Promise<void> {
        action.state = await injected.stateStore.getDeploymentState(action as unknown as TDeploymentStateParams)

        deploymentActions.push(action)

        if (isKubectlDeployAction(action)) {
          await addRolloutWaitActions(action)
        }

      },
      printPlan(logger: ILog) : boolean {
        let modified = false

        deploymentActions.forEach(function(deploymentAction: IExecutableAction) {
          if (!deploymentAction.state) {
            throw new Error("No state!")
          }
          if (deploymentAction.state.modified) {
            if (!modified) {
              if (herdKey) {
                logger.info(`Deploying ${herdKey}`)
              } else {
                logger.info("Missing herdKey for ", planInstance)
              }
            }
            modified = true
            logger.info(`  - ${deploymentAction.planString()}`)
          }
        })
        return modified
      },
      herdKey: herdKey,
      deploymentActions: deploymentActions,
    }
    return planInstance
  }


  return {
    createDeploymentPlan,
  }
}

