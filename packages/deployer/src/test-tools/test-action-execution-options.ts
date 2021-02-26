import { TActionExecutionOptions } from "../deployment-types"

export const defaultTestExecutionOptions: TActionExecutionOptions = {
  pushToUi: false,
  waitForRollout: true,
  dryRun: false,
  dryRunOutputDir: undefined,
  logContext: {},
}
