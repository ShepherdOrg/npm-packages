import * as path from "path"

import yaml = require("js-yaml")

export type TStringMap = {
  [key:string]:string
}

export type TDocumentKindNameChangeMaps = { [documentKind: string]: TStringMap }

export interface TBranchModificationParams {
  shouldModify: boolean
  origin?: string
  branchName?: string
  ttlHours?: number
  nameChangeIndex?: TDocumentKindNameChangeMaps
}


export function indexNameReferenceChange (deploymentDescriptor, branchModificationParams) {
  let nameChangeIndex = branchModificationParams.nameChangeIndex || {}
  if (!deploymentDescriptor.metadata) {
    console.warn("deploymentDescriptor without metadata!", deploymentDescriptor)
    return
  }
  nameChangeIndex[deploymentDescriptor.kind] = nameChangeIndex[deploymentDescriptor.kind] || {}
  nameChangeIndex[deploymentDescriptor.kind][deploymentDescriptor.metadata.name] =
    deploymentDescriptor.metadata.name + "-" + branchModificationParams.branchName
}

export function addResourceNameChangeIndex(plan, kubeSupportedExtensions:string[], branchModificationParams:TBranchModificationParams) {
  branchModificationParams.nameChangeIndex = branchModificationParams.nameChangeIndex || {}
  Object.entries(plan.files  as Array<any>).forEach(([fileName, deploymentFileContent]) => {
    let fileExtension = path.extname(fileName)
    if (!fileExtension) {
      return
    }
    if (!kubeSupportedExtensions[fileExtension]) {
      console.debug(`Unsupported extension ${fileExtension} on file ${fileName}`)
      return
    }

    if (deploymentFileContent.content) {
      let parsedMultiContent = yaml.safeLoadAll(deploymentFileContent.content)
      parsedMultiContent.forEach(function(parsedContent) {
        if (parsedContent) {
          indexNameReferenceChange(parsedContent, branchModificationParams)
        } else {
          console.warn("Parsed content is NULL!!!", deploymentFileContent.content)
        }
      })
    }
  })
  return branchModificationParams
}
