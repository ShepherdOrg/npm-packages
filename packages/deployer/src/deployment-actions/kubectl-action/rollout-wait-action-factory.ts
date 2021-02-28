import { IStatefulExecutableAction, IKubectlAction, TActionExecutionOptions } from "../../deployment-types"
import { extendedExec } from "../../helpers/promisified-exec"
import { TDeploymentRollout } from "./kubectl-deployment-action-factory"
import { IReleaseStateStore } from "@shepherdorg/state-store/dist"
import { IExec } from "../../helpers/basic-types"
import { ILog } from "../../logging/logger"
import { TDeploymentState } from "@shepherdorg/metadata"
import { Oops } from "oops-error"
import { createRolloutUndoActionFactory } from "./rollout-undo-actionfactory"

export type TRolloutWaitActionDependencies = {
  stateStore: IReleaseStateStore
  exec: IExec
  logger: ILog
}

export type ICreateRolloutWaitAction = {
  createRolloutWaitAction: (deploymentRollout: TDeploymentRollout) => IKubectlAction
}

export function createRolloutWaitActionFactory(dependencies: TRolloutWaitActionDependencies): ICreateRolloutWaitAction {
  let rolloutUndoActionFactory = createRolloutUndoActionFactory({
    exec: dependencies.exec,
    logger: dependencies.logger,
  })

  function createRolloutWaitAction(deploymentRollout: TDeploymentRollout): IKubectlAction {
    function planString() {
      return `kubectl --namespace ${deploymentRollout.namespace} rollout status ${deploymentRollout.deploymentKind}/${deploymentRollout.deploymentName}`
    }

    const exec = dependencies.exec
    const logger = dependencies.logger
    let identifier = `${deploymentRollout.deploymentKind}/${deploymentRollout.deploymentName}`
    const waitAction: IKubectlAction = {
      getActionDeploymentState(): TDeploymentState | undefined {
        return undefined
      },
      setActionDeploymentState(_ignore: TDeploymentState | undefined): void {},
      canRollbackExecution(): boolean {
        return false
      },

      type: "k8s",
      operation: "rollout",
      identifier: identifier,
      isStateful: false,
      descriptor: planString(),
      planString: planString,
      execute(deploymentOptions: TActionExecutionOptions): Promise<IStatefulExecutableAction> {
        if (deploymentOptions.waitForRollout) {
          return extendedExec(exec)(
            "kubectl",
            ["--namespace", deploymentRollout.namespace, "rollout", "status", identifier],
            {
              env: process.env,
              debug: true,
            }
          )
            .then(stdOut => {
              logger.info(planString(), deploymentOptions.logContext)
              logger.info(stdOut as string, deploymentOptions.logContext)
              return waitAction
            })
            .catch(async (execError: Oops) => {
              let errorContext = execError.context as { errCode: number }
              let errorMessage = `Error executing kubectl rollout status ${deploymentRollout.namespace} ${identifier}. ${execError.message} (${errorContext?.errCode})`
              const rollbackResult = rolloutUndoActionFactory
                .createRolloutUndoAction(deploymentRollout)
                .execute(deploymentOptions)
              throw new Oops({ message: errorMessage, category: "OperationalError", cause: execError })
            })
        } else {
          return Promise.resolve(waitAction)
        }
      },
    }
    return waitAction
  }

  return { createRolloutWaitAction }
}
