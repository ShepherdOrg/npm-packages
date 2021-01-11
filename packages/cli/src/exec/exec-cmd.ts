import { execFile } from "child_process"

export async function execCmd(command: string, params?: string[], options?: any) {
  return new Promise((resolve, reject) => {
    try {
      let child = execFile(command, params, options)
      let stdout = ""
      let stderr = ""

      if (!child.stdout) {
        return reject(new Error("Error opening stdout on child process"))
      }
      if (!child.stderr) {
        return reject(new Error("Error opening stderr on child process"))
      }

      child.stdout.setEncoding("utf8")
      child.stderr.setEncoding("utf8")
      child.stdout.on("data", data => {
        if (options && options.stdoutLineHandler) {
          options.stdoutLineHandler(data)
        }
        stdout += data
      })

      child.stderr.on("data", data => {
        stderr += data + "\n"
      })

      child.on("close", code => {
        resolve({ code, stdout, stderr })
      })
    } catch (err) {
      reject(err)
    }
  })
}
