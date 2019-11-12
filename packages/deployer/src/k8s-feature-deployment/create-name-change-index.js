const yamlLoad = require("../k8s-feature-deployment/multipart-yaml-load")
const path = require("path")

function createResourceNameChangeIndex(plan, kubeSupportedExtensions, featureDeploymentConfig) {
  let nameReferenceChanges = {}
  Object.entries(plan.files).forEach(([fileName, deploymentFileContent]) => {
    let fileExtension = path.extname(fileName)
    if (!fileExtension) {
      return
    }
    if (!kubeSupportedExtensions[fileExtension]) {
      console.debug(`Unsupported extension ${fileExtension} on file ${fileName}`)
      return
    }

    if (deploymentFileContent.content) {
      let parsedMultiContent = yamlLoad(deploymentFileContent.content)
      parsedMultiContent.forEach(function(parsedContent) {
        if (parsedContent) {
          if (!parsedContent.metadata) {
            console.log('parsedContent without metadata!', parsedContent)
          }
          nameReferenceChanges[parsedContent.kind] = nameReferenceChanges[parsedContent.kind] || {}
          nameReferenceChanges[parsedContent.kind][parsedContent.metadata.name] =
            parsedContent.metadata.name + "-" + featureDeploymentConfig.newName
        } else {
          console.warn("Parsed content is NULL!!!", deploymentFileContent.content)
        }
      })
    }
  })
  return nameReferenceChanges
}

module.exports = createResourceNameChangeIndex
