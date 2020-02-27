import { ILog } from "../deployment-types"
import { Oops } from "oops-error"
import { isOops } from "../helpers/isOops"

export function renderPlanExecutionError(log: ILog, err: Error | Oops) {
  log.error("Plan execution error")
  log.error(err.message)
  if (isOops(err)) {
    log.error(`Error context: ${JSON.stringify(err.context, null, 2)}`)
  }
}
