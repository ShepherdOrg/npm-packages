import { identifyDocument, TDescriptorsByKind } from "./k8s-deployment-document-identifier"
import { TBranchModificationParams } from "./k8s-feature-deployment/create-name-change-index"
import { ILog } from "../deployment-types"
import { modifyDeploymentDocument } from "./k8s-feature-deployment/modify-deployment-document"
import { Oops } from "oops-error"
import { expandEnv } from "../../expandenv"
import { processLine } from "../../base64-env-subst"
import { expandTemplate } from "../../expandtemplate"

const applyClusterPolicies = require("./apply-k8s-policy").applyPoliciesToDoc

function listDeploymentRollouts(descriptorsByKind) {
  return descriptorsByKind["Deployment"].map((deploymentDoc) => {
    return deploymentDoc.kind + "/" + deploymentDoc.metadata.name
  })
}

function expandEnvAndMustacheVariablesInFile(lines, fileContents) {
  lines.forEach(function(line, idx) {
    try {
      lines[idx] = expandEnv(line)
      lines[idx] = processLine(lines[idx], {})
    } catch (error) {
      let message = `Error expanding variables in line #${idx}: ${line}\n`
      message += error
      throw new Error(message)
    }
  })
  fileContents = lines.join("\n")
  fileContents = expandTemplate(fileContents)
  return fileContents
}

export interface TKubectrlDeployAction {
  descriptorsByKind: TDescriptorsByKind
  documentIdentifier: string
  deploymentDescriptor: string
  deploymentRollouts: string[]
  origin: string
}

export function createKubectlDeployAction(_origin: string, deploymentFileDescriptorContent: string, logger: ILog, branchModificationParams?: TBranchModificationParams) {
  let lines = deploymentFileDescriptorContent.split("\n")
  let fileContents
  let origin: string = _origin
  try {
    fileContents = expandEnvAndMustacheVariablesInFile(lines, fileContents)

    if (branchModificationParams && branchModificationParams.shouldModify) {
      fileContents = modifyDeploymentDocument(fileContents, branchModificationParams)
      origin = branchModificationParams.origin || _origin + "/branch!"
    }

    let deploymentDescriptor = applyClusterPolicies(fileContents, logger)
    let loadedDescriptor = identifyDocument(deploymentDescriptor)

    let deploymentRollouts = []

    let descriptorsByKind = loadedDescriptor.descriptorsByKind
    if (Boolean(descriptorsByKind["Deployment"])) {
      deploymentRollouts = listDeploymentRollouts(descriptorsByKind)
    }

    let documentDeploymentAction: TKubectrlDeployAction = {
      origin: origin,
      deploymentRollouts: deploymentRollouts,
      deploymentDescriptor: deploymentDescriptor,
      documentIdentifier: loadedDescriptor.identifyingString,
      descriptorsByKind: loadedDescriptor.descriptorsByKind,
    }

    return documentDeploymentAction

  } catch (error) {
    let message = `In deployment descriptor, origin: ${origin}\n`
    message += error.message

    throw new Oops({ message, category: "OperationalError", cause: error })
  }

}
