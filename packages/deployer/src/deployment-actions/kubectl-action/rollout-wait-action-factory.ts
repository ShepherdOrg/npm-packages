import {
  IExecutableAction,
  IKubectlAction,
  TActionExecutionOptions,
} from "../../deployment-types"
import { extendedExec } from "../../helpers/promisified"
import { TDeploymentRollout } from "./kubectl-deployment-action-factory"
import { IReleaseStateStore } from "@shepherdorg/state-store/dist"
import { IExec } from "../../helpers/basic-types"
import { ILog } from "../../logging/logger"
import { TDeploymentState } from "@shepherdorg/metadata"

export type TRolloutWaitActionDependencies= {
  stateStore: IReleaseStateStore,
  exec: IExec,
  logger: ILog
}

export type ICreateRolloutWaitAction = { createRolloutWaitAction: (deploymentRollout: TDeploymentRollout) => IKubectlAction }

export function createRolloutWaitActionFactory(actionDependencies: TRolloutWaitActionDependencies): ICreateRolloutWaitAction {
  function createRolloutWaitAction(deploymentRollout: TDeploymentRollout): IKubectlAction {

    function planString() {
      return `kubectl --namespace ${deploymentRollout.namespace} rollout status ${deploymentRollout.deploymentKind}/${deploymentRollout.deploymentName}`
    }

    const cmd = actionDependencies.exec
    const logger = actionDependencies.logger
    let identifier = `${deploymentRollout.deploymentKind}/${deploymentRollout.deploymentName}`
    const waitAction: IKubectlAction = {
      getActionDeploymentState(): TDeploymentState | undefined {
        return undefined;
      }, setActionDeploymentState(_ignore: TDeploymentState | undefined): void {
      },
      canRollbackExecution(): boolean {
        return false;
      },

      type: "k8s",
      operation: "rollout",
      identifier: identifier,
      isStateful: false,
      descriptor: planString(),
      planString: planString,
      execute(deploymentOptions: TActionExecutionOptions): Promise<IExecutableAction> {
        if (deploymentOptions.waitForRollout) {
          return extendedExec(cmd)("kubectl", ["--namespace", deploymentRollout.namespace, "rollout", "status", identifier], {
            env: process.env,
            debug: true,
          }).then((stdOut) => {
            logger.info(planString(), deploymentOptions.logContext)
            logger.info(stdOut as string, deploymentOptions.logContext)
            return waitAction
          }).catch((execError) => {
            const { errCode, stdOut, message: err } = execError
            logger.warn(`Error executing kubectl rollout status ${deploymentRollout}, code ${errCode}`, deploymentOptions.logContext)
            logger.warn(err, deploymentOptions.logContext)
            logger.warn(stdOut, deploymentOptions.logContext)
            return waitAction
          })
        } else {
          return Promise.resolve(waitAction)
        }
      }
    }
    return waitAction
  }

  return {createRolloutWaitAction}
}
