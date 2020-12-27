const spawn = require("child_process").execFile
const _ = require("lodash")

module.exports = {
  exec(command, params, envMap, err, success, stdoutLineHandler ) {
    envMap = envMap || {}
    let child = spawn(command, params, { env: envMap })
    let stdout = ""
    let strerr = ""
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", data => {
      if (stdoutLineHandler) {
        stdoutLineHandler(data)
      } else {
        stdout += data + "\n"
      }
    })

    child.stderr.on("data", data => {
      /*This is a bad design, should get an injected logger interface, which may be console.*/
      console.error(data)
      strerr += data + "\n"
    })

    child.on("close", code => {
      if (code) {
        if (!stdoutLineHandler) {
          /*This is a bad design, should get an injected logger interface, which may be console.*/
          console.info(stdout)
        }
        err(strerr, code, stdout)
      } else {
        success(stdout)
      }
    })
  },
  extendedExec(command, params, options, err, success) {
    let child = spawn(command, params, options)
    let stdout = ""
    let strerr = ""
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", data => {
      if (options.stdoutLineHandler) {
        options.stdoutLineHandler(data)
      }
      stdout += data
    })

    child.stderr.on("data", data => {
      if (options.stdErrLineHandler) {
        options.stdErrLineHandler(data)
      } else{
        /*This is a bad design, should get an injected logger interface, which may be console.*/
        console.error(data)
      }

      strerr += data + "\n"
    })

    child.on("close", code => {
      if (code) {
        err(strerr, code, stdout)
      } else {
        success(stdout)
      }
    })

    if (options.stdin) {
      child.stdin.setEncoding = "utf-8"
      child.stdin.write(options.stdin)
      child.stdin.end()
    }
  },
}
