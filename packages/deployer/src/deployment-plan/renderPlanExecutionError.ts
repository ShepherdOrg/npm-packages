import { Oops } from "oops-error"
import { isOops } from "../helpers/isOops"
import { ILog, TLogContext } from "../logging/logger"

export function renderPlanExecutionError(log: ILog, err: Error | Oops, logContext: TLogContext) {
  log.error("Plan execution error", err, logContext)
  log.error(err.message, undefined, logContext)
  if (isOops(err)) {
    log.error(`Error context: ${JSON.stringify(err.context, null, 2)}`, undefined, logContext)
  }
}
