import { exec } from "child_process"

export type ShellExecResults = { stdout: string; stderr: string; code: number }

export function shellExec(cmd: string, options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): Promise<ShellExecResults> {
  return new Promise(resolve => {
    exec(cmd, options, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === "number" ? error.code : 1) : 0
      resolve({ stdout: stdout.toString(), stderr: stderr.toString(), code })
    })
  })
}
