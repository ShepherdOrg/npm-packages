import { emptyArray } from "../../../helpers/ts-functions"

module.exports = function(yamlString) {

  const JSYAML = require("js-yaml")

  let files = yamlString.split("\n---\n")

  let parsedParts = emptyArray<any>()
  for (let filec of files) {
    parsedParts.push(JSYAML.safeLoad(filec))
  }
  return parsedParts
}
