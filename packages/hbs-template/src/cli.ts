#!/usr/bin/env node

import { basename } from "path"
import { readFileSync } from "fs"

"use strict"
import { expandTemplate } from "./expandtemplate"

export function readJsonFile(absolutePath: string) {
  return JSON.parse(readFileSync(absolutePath, "utf-8"))
}

const readline = require("readline")

if (process.argv.indexOf("--help") > 0) {
  let invokedName = basename(process.argv[1])
  console.log(`Usage: ${invokedName} [options]
  
Reads stdin and interprets as a handlebars template and writes back to stdout.
  
Options:
    --help:      Display this message
    --dataJson:  JSON formatted file to read template variables from.
                
If no dataJson is provided, current environment (process.env) is used to read template variables from.

Example uses in bash:
 
  echo "MyPathIs {{ PATH }}" | ${invokedName}
  echo "MyEncodedPath {{Base64Encode PATH }}" | ${invokedName}
  echo "MyEncodedFile {{Base64EncodeFile PATH_TO_SOME_FILE }}" | PATH_TO_SOME_FILE=./package.json ${invokedName}
  echo "The package name is {{ name }}" | ${invokedName} --dataJson ./package.json
  echo "Not happy with missing variable {{ NOT_A_DEFINED_VARIABLE }}" | ${invokedName} 

A missing variable or file will result in an error and a non-zero exit code.

Note: Entire file must fit in memory.
  
  `)
  process.exit(0)
}

let templateData: typeof process.env

if (process.argv.indexOf("--dataJson") > 0) {
  const dataJsonFileName = process.argv[process.argv.indexOf("--dataJson") + 1]
  templateData = readJsonFile(dataJsonFileName)
} else {
  templateData = process.env
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
})

if (process.env.DEBUG_LOG) {
  console.debug = console.debug || console.info
} else {
  console.debug = function() {}
}

let stdin = ""

rl.on("line", function(line: string) {
  stdin += line + "\n"
})

rl.on("close", function() {
  try {
    console.log(expandTemplate(stdin, templateData))
    process.exit(0)
  } catch (err) {
    console.error(err.message)
    process.exit(255)
  }
})
