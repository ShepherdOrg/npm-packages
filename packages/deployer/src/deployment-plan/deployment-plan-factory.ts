import {
  IExecutableAction,
  IKubectlDeployAction,
  ILog,
  isKubectlDeployAction,
  TActionExecutionOptions,
  TDeploymentOptions,
} from "../deployment-types"
import { TDeploymentStateParams } from "@shepherdorg/state-store/dist/state-store"
import { extendedExec } from "../helpers/promisified"
import { TDeploymentState } from "@shepherdorg/metadata/dist"
import { emptyArray } from "../helpers/ts-functions"

export interface TDeploymentPlan {
  herdKey: string,
  deploymentActions: Array<IExecutableAction> // TODO Rename to deployment actions
  addAction(action: IExecutableAction): Promise<void>

  execute(deploymentOptions: TActionExecutionOptions): Promise<IExecutableAction[]>
}

export type TK8sDeploymentPlan = { [herdKey: string]: TDeploymentPlan }
export type TDockerDeploymentPlanTuple = [string, TDeploymentPlan]
export type TDockerDeploymentPlan = { [herdKey: string]: TDeploymentPlan }

/* At present, CreateDeploymentPlan is only supporting the orchestration part, not the actual planning part.
* TODO : Move planning logic here (from image-deployment-planner), stop moving actions around and move deployment plans around instead. */

interface TDeploymentPlanDependencies {
  stateStore: any // Need to type this ReturnType<typeof ReleaseStateStore>
  cmd: any
  logger: ILog
}

// TODO: Create independent tests for this. Test exception handling. Add timeout specification, test timeout handling. Need support in fake kubectl
export function RolloutWaitActionFactory(deploymentRollout: string): IExecutableAction {

  function planString() {
    return `kubectl rollout status ${deploymentRollout}`
  }

  const waitAction: IExecutableAction = {
    pushToUI: false,
    descriptor: deploymentRollout,
    planString: planString,
    execute(deploymentOptions: TDeploymentOptions & { waitForRollout: boolean; pushToUi: boolean }, cmd: any, logger: ILog, _saveDeploymentState: (stateSignatureObject: any) => Promise<TDeploymentState>): Promise<IExecutableAction> {
      if (deploymentOptions.waitForRollout) {
        return extendedExec(cmd)("kubectl", ["rollout", "status", deploymentRollout], {
          env: process.env,
          debug: true,
        }).then((stdOut) => {
          logger.info(planString())
          logger.info(stdOut)
          return waitAction
        }).catch((execError)=>{
          const { errCode, stdOut, message: err } = execError
          logger.warn(`Error executing kubectl rollout status ${deploymentRollout}, code ${errCode}`)
          logger.warn(err)
          logger.warn(stdOut)
          return waitAction
        })
      } else {
        return Promise.resolve(waitAction)
      }
    },
  }
  return waitAction
}

export function DeploymentPlanFactory(dependencies: TDeploymentPlanDependencies) {

  function createDeploymentPlan(herdKey: string): TDeploymentPlan {
    const deploymentActions: Array<IExecutableAction> = []


    async function addRolloutWaitActions(thisIsMe: IKubectlDeployAction) {

      if (thisIsMe.deploymentRollouts && thisIsMe.operation === "apply") {
        await Promise.all(thisIsMe.deploymentRollouts.map(async (deploymentRollout) => {
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

