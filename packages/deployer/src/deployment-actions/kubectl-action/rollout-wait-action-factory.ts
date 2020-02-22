import {
  IExecutableAction,
  IKubectlAction,
  ILog,
  TActionExecutionOptions,
} from "../../deployment-types"
import { extendedExec } from "../../helpers/promisified"
import { TDeploymentRollout } from "./create-kubectl-deployment-action"
import { IReleaseStateStore } from "@shepherdorg/state-store/dist"
import { IExec } from "../../helpers/basic-types"

export type TRolloutWaitActionDependencies= {
  stateStore: IReleaseStateStore,
  exec: IExec,
  logger: ILog
}

export type ICreateRolloutWaitActions = { RolloutWaitActionFactory: (deploymentRollout: TDeploymentRollout) => IKubectlAction }

export function createRolloutWaitActionFactory(actionDependencies: TRolloutWaitActionDependencies): ICreateRolloutWaitActions {
  function RolloutWaitActionFactory(deploymentRollout: TDeploymentRollout): IKubectlAction {

    function planString() {
      return `kubectl --namespace ${deploymentRollout.namespace} rollout status ${deploymentRollout.deploymentKind}/${deploymentRollout.deploymentName}`
    }

    const cmd = actionDependencies.exec
    const logger = actionDependencies.logger
    let identifier = `${deploymentRollout.deploymentKind}/${deploymentRollout.deploymentName}`
    const waitAction: IKubectlAction = {

      type: "k8s",
      operation: "rollout",
      identifier: identifier,
      pushToUI: false,
      descriptor: planString(),
      planString: planString,
      execute(deploymentOptions: TActionExecutionOptions): Promise<IExecutableAction> {
        if (deploymentOptions.waitForRollout) {
          return extendedExec(cmd)("kubectl", ["--namespace", deploymentRollout.namespace, "rollout", "status", identifier], {
            env: process.env,
            debug: true,
          }).then((stdOut) => {
            logger.info(planString())
            logger.info(stdOut)
            return waitAction
          }).catch((execError) => {
            const { errCode, stdOut, message: err } = execError
            logger.warn(`Error executing kubectl rollout status ${deploymentRollout}, code ${errCode}`)
            logger.warn(err)
            logger.warn(stdOut)
            return waitAction
          })
        } else {
          return Promise.resolve(waitAction)
        }
      }
    }
    return waitAction
  }

  return {RolloutWaitActionFactory}
}
