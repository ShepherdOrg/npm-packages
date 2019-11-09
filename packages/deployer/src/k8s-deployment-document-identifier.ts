const YAML = require("js-yaml")

function identifyDocument(deploymentDocument) {
  try {
    if (deploymentDocument.indexOf("---\n") > 0) {
      let parts = deploymentDocument.split("---\n")
      deploymentDocument = parts[0]
    }
    let deploymentdocument = YAML.safeLoad(deploymentDocument)

    let identifyingString = deploymentdocument.kind
    if (deploymentdocument.metadata) {
      identifyingString += "_" + deploymentdocument.metadata.name

      if (
        deploymentdocument.metadata.namespace &&
        deploymentdocument.metadata.namespace !== "default"
      ) {
        identifyingString =
          deploymentdocument.metadata.namespace + "_" + identifyingString
      }
    }
    return identifyingString
  } catch (e) {
    console.error(deploymentDocument)
    console.error("Error classifying deployment document (see above).", e)
    process.exit(255)
  }
}

module.exports = identifyDocument
