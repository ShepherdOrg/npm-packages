const yamlLoad = require("../k8s-feature-deployment/multipart-yaml-load")
const path = require("path")
const _ = require("lodash")

function createResourceNameChangeIndex(
  plan,
  kubeSupportedExtensions,
  featureDeploymentConfig
) {
  let nameReferenceChanges = {}
  _.forEach(plan.files, function(deploymentFileContent, fileName) {
    let fileExtension = path.extname(fileName)
    if (!fileExtension) {
      return
    }
    if (!kubeSupportedExtensions[fileExtension]) {
      console.debug(
        `Unsupported extension ${fileExtension} on file ${fileName}`
      )
      return
    }

    if (deploymentFileContent.content) {
      let parsedMultiContent = yamlLoad(deploymentFileContent.content)
      _.forEach(parsedMultiContent, function(parsedContent) {
        if (parsedContent) {
          nameReferenceChanges[parsedContent.kind] =
            nameReferenceChanges[parsedContent.kind] || {}
          nameReferenceChanges[parsedContent.kind][
            parsedContent.metadata.name
          ] =
            parsedContent.metadata.name + "-" + featureDeploymentConfig.newName
        } else {
          console.warn(
            "Parsed content is NULL!!!",
            deploymentFileContent.content
          )
        }
      })
    }
  })
  return nameReferenceChanges
}

module.exports = createResourceNameChangeIndex
