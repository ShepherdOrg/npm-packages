import { TExecError, FExec, formatExecErrorMessage, formatCommandLine } from "../exec"

export type IFakeExecution = {
  addResponse: (response: Partial<TExecResponse>) => IFakeExecution
  exec: FExec
  onExec?: FExec
  executedCommands: TCommandRecording[]
  executedCommandLines: () => Array<string>
}

export type TCommandRecording = {
  options: Object
  params: string[]
  command: string
}

type TExecResponse = { code: number; stderr?: string; stdout: string }

export function initFakeExecution(execResponses?: Array<TExecResponse>): IFakeExecution {
  let executedCommands: Array<TCommandRecording> = []

  let responseSequence: Array<TExecResponse> = execResponses || []

  let fakeExec: IFakeExecution = {
    executedCommandLines: () => {
      return fakeExec.executedCommands.map(ec => ec.command + " " + ec.params.join(" "))
    },
    addResponse: response => {
      responseSequence.push({
        stdout: response.stdout || "",
        stderr: response.stderr,
        code: response.code || 0,
      })
      return fakeExec
    },
    executedCommands: executedCommands,
    onExec: undefined,
    async exec(command, params, options, stdHandler) {
      let commandRecording: TCommandRecording = {
          command: command,
          params: params || [],
          options: options || {},
        },
        nextResponse: TExecResponse | undefined
      fakeExec.executedCommands.push(commandRecording)
      if (fakeExec && fakeExec.onExec != undefined) {
        return fakeExec.onExec(command, params, options)
      } else if (responseSequence.length > 0) {
        nextResponse = responseSequence.shift()
      } else {
        nextResponse = {
          code: 0,
          stdout: "All is fine and dandy",
          stderr: "",
        }
      }
      if (nextResponse) {
        if (nextResponse.code !== 0) {
          throw new TExecError(
            nextResponse.code,
            formatExecErrorMessage(command, params, nextResponse.code),
            nextResponse.stderr || "",
            nextResponse.stdout
          )
        } else {
          return {
            command: formatCommandLine(command, params),
            code: 0,
            stdout: nextResponse.stdout,
            stderr: nextResponse.stderr || "",
          }
        }
      } else {
        throw new Error("I was wrong, nextResponse CAN be null!")
      }
    },
  }
  return fakeExec
}
