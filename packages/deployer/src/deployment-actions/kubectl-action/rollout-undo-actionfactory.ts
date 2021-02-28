import { extendedExec } from "../../helpers/promisified-exec"
import { TDeploymentRollout } from "./kubectl-deployment-action-factory"
import { IExecutableActionV2, TActionExecutionOptions, TRollbackResult } from "../../deployment-types"
import { IExec } from "../../helpers/basic-types"
import { ILog } from "../../logging/logger"

export function createRolloutUndoActionFactory({ exec, logger }: { exec: IExec; logger: ILog }) {
  const createRolloutUndoAction = (rollout: TDeploymentRollout) => {
    let undoAction: IExecutableActionV2<TRollbackResult> = {
      execute(deploymentOptions: TActionExecutionOptions): Promise<TRollbackResult> {
        return extendedExec(exec)(
          "kubectl",
          ["--namespace", rollout.namespace, "rollout", "undo", `deployment/${rollout.deploymentName}`],
          {
            env: process.env,
            debug: true,
          }
        )
          .then(stdOut => {
            logger.info(stdOut as string, deploymentOptions.logContext)
            logger.info("Rollback complete.", deploymentOptions.logContext)
            return {
              stdOut: stdOut as string,
              code: 0,
              stdErr: "",
              executedAction: undoAction,
            }
          })
          .catch(execError => {
            logger.warn(
              `Error executing kubectl rollout undo ${rollout}, code ${execError.errCode}`,
              deploymentOptions.logContext
            )
            logger.warn(execError.message, deploymentOptions.logContext)
            logger.warn(execError.stdOut, deploymentOptions.logContext)

            let rollbackResult: TRollbackResult = {
              code: execError.context.errCode,
              stdOut: execError.stdOut as string,
              stdErr: execError.message,
              executedAction: undoAction,
            }

            return rollbackResult
          })
      },
      planString(): string {
        return [
          "kubectl",
          "--namespace",
          rollout.namespace,
          "rollout",
          "undo",
          `deployment/${rollout.deploymentName}`,
        ].join(" ")
      },
    }
    return undoAction
  }
  return {
    createRolloutUndoAction,
  }
}
