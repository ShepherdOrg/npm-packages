import { emptyArray } from "../helpers/ts-functions"
import { expect } from "chai"
import { FExecutionCallback } from "../helpers/basic-types"

function emptyVariable<T>() {
  return undefined as unknown as T
}

export type TFakeExec = { nextResponse: { err: string | undefined; success: string | undefined }; extendedExec: (command: string, params: string[], options: Object, err: FExecutionCallback, success: FExecutionCallback) => void; onExec: undefined; executedCommands: any[] }

export  function createFakeExec() : TFakeExec {
  let fakeExec = {
    executedCommands: emptyArray<any>(),
    nextResponse: {
      err: emptyVariable<string | undefined>(),
      success: emptyVariable<string | undefined>(),
    },
    onExec:undefined,
    extendedExec: function(command:string, params:string[], options:Object, err:FExecutionCallback, success:FExecutionCallback) {
      fakeExec.executedCommands.push({
        command: command,
        params: params,
        options: options,
        err: err,
        success: success,
      })
      if (fakeExec && fakeExec.onExec != undefined) {
        // @ts-ignore
        fakeExec.onExec(command, params, options, err, success)
      } else if (fakeExec.nextResponse) {
        if (fakeExec.nextResponse.success) {
          success(fakeExec.nextResponse.success as string)
        } else {
          err(
            fakeExec.nextResponse.err ||
              "No execution response defined for " +
                JSON.stringify({ command, params, options })
          )
        }
      } else {
        expect.fail("No response defined!!!!")
      }
    },
  }
  return fakeExec
}
