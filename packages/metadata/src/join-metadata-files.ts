#!/usr/bin/env node

import { readJsonFile, validateAndCombineFullProps } from "./shepherdJson"

let userPropsFile = process.argv[2]
let generatedPropsFile = process.argv[3]

if (
  !generatedPropsFile ||
  !userPropsFile ||
  process.argv.indexOf("--help") > 0
) {
  console.info(`Validated and join user specified properties and build generated properties into one JSON structure to be packaged in a docker label.

Usage:
${process.argv[1]}  <user props json file>  <generated props json file>    

Order of file names is significant to enable schema validation.
    
    `)
  process.exit(1)
}

const userProps = readJsonFile(userPropsFile)
const generatedProps = readJsonFile(generatedPropsFile)

try {
  const fullProps = validateAndCombineFullProps(userProps, generatedProps)
  console.info(JSON.stringify(fullProps))
} catch (err) {
  console.error(err.message)
  process.exit(255)
}
