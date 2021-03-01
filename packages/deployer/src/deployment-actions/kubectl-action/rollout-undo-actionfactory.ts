import { TDeploymentRollout } from "./kubectl-deployment-action-factory"
import { IExecutableActionV2, TActionExecutionOptions, TRollbackResult } from "../../deployment-types"
import { ILog } from "../../logging/logger"
import { FExec, TExecError } from "@shepherdorg/ts-exec"

export function createRolloutUndoActionFactory({ exec, logger }: { exec: FExec; logger: ILog }) {
  const createRolloutUndoAction = (rollout: TDeploymentRollout) => {
    let undoAction: IExecutableActionV2<TRollbackResult> = {
      execute(deploymentOptions: TActionExecutionOptions): Promise<TRollbackResult> {
        return exec(
          "kubectl",
          ["--namespace", rollout.namespace, "rollout", "undo", `deployment/${rollout.deploymentName}`],
          {
            env: process.env,
            doNotCollectOutput: false,
          }
        )
          .then(({ stdout }) => {
            logger.info(stdout, deploymentOptions.logContext)
            logger.info("Rollback complete.", deploymentOptions.logContext)
            return {
              stdOut: stdout,
              code: 0,
              stdErr: "",
              executedAction: undoAction,
            }
          })
          .catch(err => {
            const execError = err as TExecError
            logger.warn(
              `Error executing kubectl rollout undo ${rollout}, code ${err.errCode}`,
              deploymentOptions.logContext
            )
            logger.warn(execError.message, deploymentOptions.logContext)
            logger.warn(execError.stdout, deploymentOptions.logContext)

            let rollbackResult: TRollbackResult = {
              code: execError.code,
              stdOut: execError.stdout,
              stdErr: execError.stderr,
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
