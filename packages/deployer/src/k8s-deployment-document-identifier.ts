const YAML = require("js-yaml")

function identifyDocument(deploymentDocument) {
  try {
    let descriptorsByKind = {}

    let identifyingString=""

    YAML.safeLoadAll(deploymentDocument, (documentPart)=>{
      if(!documentPart){
        return
      }
      if(!identifyingString){
        identifyingString = documentPart.kind
        if (documentPart.metadata) {
          identifyingString += "_" + documentPart.metadata.name

          if (
            documentPart.metadata.namespace &&
            documentPart.metadata.namespace !== "default"
          ) {
            identifyingString =
              documentPart.metadata.namespace + "_" + identifyingString
          }
        }
      }
      descriptorsByKind[documentPart.kind] = descriptorsByKind[documentPart.kind] || []
      descriptorsByKind[documentPart.kind].push( documentPart)
    })

    return {identifyingString, descriptorsByKind }
  } catch (e) {
    console.error(deploymentDocument)
    console.error("Error classifying deployment document (see above).", e)
    process.exit(255)
  }
}

module.exports = identifyDocument
