import {
  IExecutableAction,
  IKubectlDeployAction,
  ILog,
  isKubectlDeployAction,
  TActionExecutionOptions,
} from "../deployment-types"
import { TDeploymentStateParams } from "@shepherdorg/state-store/dist/state-store"
import { emptyArray } from "../helpers/ts-functions"
import { RolloutWaitActionFactory } from "../deployment-actions/kubectl-deployer/rollout-wait-action-factory"

export interface IDeploymentPlan {
  herdKey: string,
  deploymentActions: Array<IExecutableAction>
  addAction(action: IExecutableAction): Promise<void>

  execute(deploymentOptions: TActionExecutionOptions): Promise<IExecutableAction[]> // TODO: Introduce an IExecutableActionResult
}


export type TK8sDeploymentPlansByKey = { [herdKey: string]: IDeploymentPlan }
export type TDockerDeploymentPlanTuple = [string, IDeploymentPlan]
export type TDockerDeploymentPlansByKey = { [herdKey: string]: IDeploymentPlan }

/* At present, CreateDeploymentPlan is only supporting the orchestration part, not the actual planning part.
* TODO : Move planning logic here (from image-deployment-planner), stop moving actions around and move deployment plans around instead.
*  How does rollback on failure? We need to mark the deployment as failed. Or do we? Keep the UI simple and only display successful builds
* there for now.
* Deployment state updated with deployment action. Create on-failure action which deploys last good version.
* Deployment action
* Refactoring order:
*      Change all loaders to return IDeploymentPlan
*      Change orchestrator to accept and execute IDeploymentPlan
*      Rollout wait action creation should be in image loader. Refactor and rethink derivedDeployments in this context ( derived deploymentActions ?).
*         Derived deployments should go into deployment plan.
*      Probably: Change loader concept into IImageDeploymentPlanFactory, IFolderDeploymentPlanFactory
*      See what can be done about simplifying image data information passing around. Information hiding!
*  */

interface TDeploymentPlanDependencies {
  stateStore: any // Need to type this ReturnType<typeof ReleaseStateStore>
  cmd: any
  logger: ILog
}

export function DeploymentPlanFactory(dependencies: TDeploymentPlanDependencies) {

  function createDeploymentPlan(herdKey: string): IDeploymentPlan {
    const deploymentActions: Array<IExecutableAction> = []


    async function addRolloutWaitActions(kubectlDeployAction: IKubectlDeployAction) {

      if (kubectlDeployAction.deploymentRollouts && kubectlDeployAction.operation === "apply" && kubectlDeployAction.state?.modified) {
        await Promise.all(kubectlDeployAction.deploymentRollouts.map(async (deploymentRollout) => {
          await planInstance.addAction(RolloutWaitActionFactory(deploymentRollout))
        }, {}))
      }
    }

    let planInstance = {
      execute(deploymentOptions: TActionExecutionOptions) {

        return deploymentActions.reduce((p, nextAction)=>{
          return p.then((execResults)=>{
            return nextAction.execute(deploymentOptions, dependencies.cmd, dependencies.logger, dependencies.stateStore.saveDeploymentState).then((actionResult)=>{
              execResults.push(actionResult)
              return execResults
            })
          })
        }, Promise.resolve(emptyArray<IExecutableAction>()))

        // return Bluebird.all(deploymentActions.map(async (k8sDeploymentAction) => {
        //   return await k8sDeploymentAction.execute(deploymentOptions, dependencies.cmd, dependencies.logger, dependencies.stateStore.saveDeploymentState)
        // }))
      },
      async addAction(action: IExecutableAction): Promise<void> {
        action.state = await dependencies.stateStore.getDeploymentState(action as unknown as TDeploymentStateParams)

        deploymentActions.push(action)

        if (isKubectlDeployAction(action)) {
          await addRolloutWaitActions(action)
        }

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

