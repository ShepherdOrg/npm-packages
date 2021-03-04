import { IStatefulExecutableAction, IKubectlAction, TActionExecutionOptions } from "../../deployment-types"
import { TDeploymentRollout } from "./kubectl-deployment-action-factory"
import { IReleaseStateStore } from "@shepherdorg/state-store/dist"
import { ILog } from "@shepherdorg/logger"
import { TDeploymentState } from "@shepherdorg/metadata"
import { Oops } from "oops-error"
import { createRolloutUndoActionFactory } from "./rollout-undo-actionfactory"
import { FExec, TExecError } from "@shepherdorg/ts-exec"

export type TRolloutWaitActionDependencies = {
  stateStore: IReleaseStateStore
  exec: FExec
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
          let params = ["--namespace", deploymentRollout.namespace, "rollout", "status"]
          if (deploymentOptions.rolloutWaitSeconds && deploymentOptions.rolloutWaitSeconds > 0) {
            params.push(`--timeout=${deploymentOptions.rolloutWaitSeconds}s`)
          }
          params.push(identifier)
          return exec("kubectl", params, {
            env: process.env,
            doNotCollectOutput: false,
          })
            .then(execResult => {
              logger.info(execResult.command, deploymentOptions.logContext)
              logger.info(execResult.stdout, deploymentOptions.logContext)
              return waitAction
            })
            .catch(async (execError: TExecError) => {
              let errorMessage = `Error waiting for rollout to finish. ${execError.message}`

              /*NOTE: Rollout undo will not throw on failure, it will log the failure. */
              const undoResult = await rolloutUndoActionFactory
                .createRolloutUndoAction(deploymentRollout)
                .execute(deploymentOptions)

              if (undoResult.code !== 0) {
                errorMessage += "\nRollback undo was attempted, but failed!"
              }
              throw new Oops({
                message: errorMessage,
                category: "OperationalError",
                cause: execError,
                context: { identifier, operation: "rollout", planString: planString() },
              })
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
