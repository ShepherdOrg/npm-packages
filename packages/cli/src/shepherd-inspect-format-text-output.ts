export let inspectFormatText = imageMetadata => {
  function renderFileList(kubeDeploymentFiles: any) {
    return (
      "\n    " + Object.getOwnPropertyNames(kubeDeploymentFiles).join("\n    ")
    )
  }

  let rendered = `
${imageMetadata.displayName} ${imageMetadata.semanticVersion}
`
  if (imageMetadata.migrationImage) {
    rendered += `
    Linked migration image - ${imageMetadata.migrationImage}
`
  }

  rendered += `  Shepherd type & role: ${imageMetadata.deploymentType} - ${
    imageMetadata.deployerRole
  }

Built - ${imageMetadata.buildDate} on ${imageMetadata.buildHostName}
Git branch - ${imageMetadata.gitBranch}
Git hash - ${imageMetadata.gitHash}
Git url - ${imageMetadata.gitUrl}
 ${(imageMetadata.kubeConfigB64 &&
   "\nK8S deployment files:" +
     renderFileList(imageMetadata.kubeDeploymentFiles)) ||
   ""}
`

  if (imageMetadata.deploymentType === "deployer") {
    rendered += `
deployCommand - ${imageMetadata.deployCommand}
rollbackCommand - ${imageMetadata.rollbackCommand}
${imageMetadata.environmentVariablesExpansionString &&
  "environment variables expansion string"} `
  }

  rendered += `
Last commits:
${imageMetadata.lastCommits}
`

  if (imageMetadata.hyperlinks && imageMetadata.hyperlinks.length) {
    rendered += "Links:\n        "
    rendered += imageMetadata.hyperlinks
      .map(href => {
        return href.title + " -> " + href.url
      })
      .join("\n        ")
  }

  return rendered
}
