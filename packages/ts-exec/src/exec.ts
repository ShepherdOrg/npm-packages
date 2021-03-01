import { execFile, ExecFileOptions } from "child_process"

export type TExecResult = { code: number; stdout: string; stderr: string }

const BUFFER_ENCODING: "utf-8" = "utf-8"

export type TExecOptions = ExecFileOptions & { doNotCollectOutput?: boolean; stdin?: string }

export type FExec = (
  command: string,
  params?: string[],
  options?: TExecOptions,
  stdHandler?: Pick<Console, "info" | "error">
) => Promise<TExecResult>

export class TExecError extends Error {
  public code: number
  public stdout: string
  public stderr: string
  constructor(code: number, message: string, errBuffer: string, stdout: string) {
    super(message)
    this.code = code
    this.stderr = errBuffer
    this.stdout = stdout
  }
}

export function formatExecErrorMessage(command: string, params: string[] | undefined, code: number) {
  return `${command}${
    params && params.length ? " " + params.join(" ") + ". " : ". "
  }Process exited with error code ${code}`
}

export const exec: FExec = async (
  command: string,
  params?: string[],
  options?: TExecOptions,
  stdHandler?: Pick<Console, "info" | "error">
): Promise<TExecResult> => {
  let returnOutput = !options?.doNotCollectOutput

  return new Promise((resolve, reject) => {
    try {
      let child = execFile(command, params, options)
      let outBuffer = ""
      let errBuffer = ""

      if (!child.stdout) {
        return reject(new Error("Error opening stdout on child process"))
      }
      if (!child.stderr) {
        return reject(new Error("Error opening stderr on child process"))
      }

      child.stdout.setEncoding(BUFFER_ENCODING)
      child.stderr.setEncoding(BUFFER_ENCODING)
      child.stdout.on("data", data => {
        if (stdHandler) {
          stdHandler.info(data)
        }
        if (returnOutput) {
          outBuffer += data
        }
      })

      child.stderr.on("data", data => {
        if (stdHandler) {
          stdHandler.error(data)
        }
        if (returnOutput) {
          errBuffer += data + "\n"
        }
      })

      child.on("close", code => {
        if (code === 0) {
          let execResult: TExecResult = { code: code, stdout: outBuffer.toString(), stderr: errBuffer }
          resolve(execResult)
        } else {
          reject(new TExecError(code, formatExecErrorMessage(command, params, code), errBuffer, outBuffer))
        }
      })

      if (options && options.stdin) {
        if (!child.stdin) {
          throw new TExecError(
            255,
            `Unable to open stdin for child process ${formatExecErrorMessage(command, params, 255)}`,
            "",
            ""
          )
        }
        child.stdin.write(options.stdin, "utf-8")
        child.stdin.end()
      }
    } catch (err) {
      reject(err)
    }
  })
}
