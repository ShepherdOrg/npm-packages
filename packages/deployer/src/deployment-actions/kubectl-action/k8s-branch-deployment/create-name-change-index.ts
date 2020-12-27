import * as path from "path"
import { newProgrammerOops } from "oops-error"
import { kubeSupportedExtensions, TExtensionsMap } from "../kube-supported-extensions"
import { TK8sPartialDescriptor } from "../k8s-document-types"
import { TK8sDeploymentPlan } from "../../../deployment-types"

import * as yaml from "js-yaml"

export type TStringMap = {
  [key: string]: string
}

export type TDocumentKindNameChangeMaps = { [documentKind: string]: TStringMap }

export interface TBranchModificationParams {
  shouldModify: boolean
  origin?: string
  branchName?: string
  ttlHours?: number
  nameChangeIndex?: TDocumentKindNameChangeMaps
}

export function indexNameReferenceChange(
  deploymentDescriptor: TK8sPartialDescriptor,
  branchModificationParams: TBranchModificationParams
) {
  let nameChangeIndex = branchModificationParams.nameChangeIndex || {}
  if (!deploymentDescriptor.metadata) {
    console.warn("deploymentDescriptor without metadata!", deploymentDescriptor)
    return
  }
  nameChangeIndex[deploymentDescriptor.kind] = nameChangeIndex[deploymentDescriptor.kind] || {}
  let name = deploymentDescriptor.metadata.name || "unknown"
  nameChangeIndex[deploymentDescriptor.kind][name] = name + "-" + branchModificationParams.branchName
}

export function addResourceNameChangeIndex(
  plan: TK8sDeploymentPlan,
  branchModificationParams: TBranchModificationParams,
) {
  branchModificationParams.nameChangeIndex = branchModificationParams.nameChangeIndex || {}
  if (plan.files) {
    Object.entries(plan.files).forEach(([fileName, deploymentFileContent]) => {
      let fileExtension: string = path.extname(fileName)
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
  } else {
    throw newProgrammerOops("plan.files no really optional here, in herd key " + plan.herdKey)
  }
  return branchModificationParams
}
