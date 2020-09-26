#!/usr/bin/env node

import { inspectAndExtractShepherdMetadata } from "./shepherd-inspect"
import { inspectFormatText } from "./shepherd-inspect-format-text-output"

let dockerImageReference = process.argv[2]

if (!dockerImageReference || process.argv.includes("--help")) {
  console.info(`
Inspect shepherd metadata for a docker image.

Usage:
${process.argv[1]}  <DockerImageReference>     

Options:
    --json        Output full metadata, including extracted files.

Example:

${process.argv[1]} shepherdorg/shepherd:latest     
    `)
  process.exit(1)
}

let formatOutput

if (process.argv.indexOf("--json") > 0) {
  formatOutput = JSON.stringify
} else {
  formatOutput = inspectFormatText
}

inspectAndExtractShepherdMetadata(dockerImageReference)
  .then(formatOutput)
  .then(console.info)
