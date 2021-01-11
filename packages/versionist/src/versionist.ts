#!/usr/bin/env node
"use strict"

import { asBashExports, versionInfo } from "./index"
import * as path from "path"

function printUsage() {
  console.info(`Usage: versionist /path/to/docker-project <option>

Options:
  --bash-export dockerRegistry branchName     Output version info in an appropriate format for bash eval, to use with shepherd-build-docker bash script.
`)
}

function hasArg(param: string) {
  return process.argv.includes(param)
}

function argValue(param: string, offset: number = 1): string | undefined {
  let argIndex = process.argv.indexOf(param)
  return process.argv[argIndex + offset] || undefined
}

async function main() {
  if (hasArg("--help")) {
    1
    printUsage()
    process.exit(0)
  }

  let targetDir = path.resolve(process.argv[2])

  if (hasArg("--bash-export")) {
    let dockerRegistry = argValue("--docker-registry", 1) || ""
    let branchName = argValue("--branch-name", 1) || ""
    const dirVersion = await versionInfo(targetDir, { dockerRegistry: dockerRegistry, branchName: branchName })
    const bashExports = asBashExports(dirVersion)
    console.info(bashExports)
  }

  if (hasArg("--json")) {
    let dockerRegistry = argValue("--docker-registry", 1) || ""
    let branchName = argValue("--branch-name", 1) || ""
    const dirVersion = await versionInfo(targetDir, { dockerRegistry: dockerRegistry, branchName: branchName })

    console.info(JSON.stringify(dirVersion))
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error("Error occurred", err)
    process.exit(-1)
  })
