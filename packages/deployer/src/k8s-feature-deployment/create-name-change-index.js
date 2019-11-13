const yamlLoad = require("../k8s-feature-deployment/multipart-yaml-load")
const path = require("path")

function indexNameReferenceChange (deploymentDescriptor, featureDeploymentConfig) {
  let nameChangeIndex = featureDeploymentConfig.nameChangeIndex || {}
  if (!deploymentDescriptor.metadata) {
    console.warn("deploymentDescriptor without metadata!", deploymentDescriptor)
    return
  }
  nameChangeIndex[deploymentDescriptor.kind] = nameChangeIndex[deploymentDescriptor.kind] || {}
  nameChangeIndex[deploymentDescriptor.kind][deploymentDescriptor.metadata.name] =
    deploymentDescriptor.metadata.name + "-" + featureDeploymentConfig.newName
}

function addResourceNameChangeIndex(plan, kubeSupportedExtensions, featureDeploymentConfig) {
  featureDeploymentConfig.nameChangeIndex = featureDeploymentConfig.nameChangeIndex || {}
  console.log('featureDeploymentConfig.............', featureDeploymentConfig)
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
          indexNameReferenceChange(parsedContent, featureDeploymentConfig)
        } else {
          console.warn("Parsed content is NULL!!!", deploymentFileContent.content)
        }
      })
    }
  })
  console.log('After indexing: ', featureDeploymentConfig)
  return featureDeploymentConfig
}

module.exports = {
  addResourceNameChangeIndex: addResourceNameChangeIndex,
  indexNameReferenceChange
}
