import * as fs from 'fs'

const omit = require('lodash').omit

module.exports = function() {
  let reservedNames:Array<string> = []

  const RESERVED_NAMES = [
    "AWS_DEFAULT_PROFILE",
    "DISPLAY",
    "GOPATH",
    "HOME",
    "KUBECONFIG",
    "PATH",
    "PWD",
    "SHELL",
    "SHLVL",
    "SSH_CLIENT",
    "TERM",
    "USER",
    "XAUTHORITY",
  ]

  reservedNames = reservedNames.concat(RESERVED_NAMES)

  let dockerEnvGenerator = {
    generateEnvString(env) {
      let retracted = omit(env, reservedNames)
      let buffer:Array<any> = []
      Object.entries(retracted).forEach(([key, value])=>{
        {
          buffer.push(key)
          buffer.push("=")
          buffer.push(value)
          buffer.push("\n")
        }
      })
      return buffer.join("")
    },
    generateEnvFile(fileName, env) {
      let data = this.generateEnvString(env)
      fs.writeFileSync(fileName, data)
    },
  }
  return dockerEnvGenerator
}
