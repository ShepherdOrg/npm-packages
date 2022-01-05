#!/usr/bin/env node
"use strict"

import { asBashExports, DEFAULT_SEMANTIC_VERSION, versionInfo } from "./index"
import * as path from "path"

function printUsage() {
  console.info(`Usage: versionist /path/to/docker-project <option>
Versionist collects naming, version and source hash information for a directory and outputs to standard output in the
specified format.

Semantic versioning strategy choices:
  --prefer-txt                                Prefer version.txt files over package.json  
  --prefer-package-json                       Prefer package.json version.
  --prefer-parameter                          Prefer parameter input (default)
  --error-on-inconsistent-version             Exit with error if multiple versions are found that are inconsistent.
By default, the versionist will prefer parameter over txt over package.json. If no version is found, the default is ${DEFAULT_SEMANTIC_VERSION}
  
Input options:
  --docker-registry dockerRegistry            Docker registry part of the image tag.
  --branch-name branchName                    Branch name. Branch name is prepended to the version info to distinguish between different branches.
  --semantic-version semanticVersion          Semantic version.

Output format options:
  --bash-export dockerRegistry branchName     Output version info in an appropriate format for bash eval, to use with shepherd-build-docker bash script.
  --json                                      Output version info in JSON format.
  
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

  let dockerRegistry = argValue("--docker-registry", 1) || ""
  let dockerOrganisation = argValue("--docker-organisation", 1) || undefined
  let branchName = argValue("--branch-name", 1) || ""

  let semanticVersion = argValue("--semantic-version", 1) || undefined

  const dirVersion = await versionInfo(targetDir, {
    dockerRegistry: dockerRegistry,
    branchName: branchName,
    dockerOrganization: dockerOrganisation,
    semanticVersion: semanticVersion,
  })

  if (hasArg("--bash-export")) {
    const bashExports = asBashExports(dirVersion)
    console.info(bashExports)
  }

  if (hasArg("--json")) {
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
