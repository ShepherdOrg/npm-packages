import { identifyDocument, TDescriptorsByKind } from "./k8s-deployment-document-identifier"
import { TBranchModificationParams } from "./k8s-feature-deployment/create-name-change-index"
import { ILog, THerdSpec } from "../deployment-types"
import { modifyDeploymentDocument } from "./k8s-feature-deployment/modify-deployment-document"
import { newProgrammerOops, Oops } from "oops-error"
import { expandEnv } from "../../expandenv"
import { processLine } from "../../base64-env-subst"
import { expandTemplate } from "../../expandtemplate"
import * as path from "path"
import { extendedExec, writeFile } from "../../promisified"
import { TDeploymentState, TK8sMetadata } from "@shepherdorg/metadata"

const applyClusterPolicies = require("./apply-k8s-policy").applyPoliciesToDoc

import Bluebird = require("bluebird")
import { TActionExecutionOptions } from "../release-plan"


export interface TKubectrlDeployAction {
  descriptorsByKind: TDescriptorsByKind
  identifier: string
  descriptor: string
  deploymentRollouts: string[]
  origin: string
  operation: string
  state?: TDeploymentState

  execute(deploymentOptions, cmd, logger, saveDeploymentState)
}

export interface TK8sDockerImageDeploymentAction extends TKubectrlDeployAction {
  herdSpec: THerdSpec
  metadata: TK8sMetadata
  version: string,
  type: string,
  fileName: string,
  herdKey: string,
}


async function executeDeploymentAction(thisIsMe: TKubectrlDeployAction, actionExecutionOptions: TActionExecutionOptions, cmd: any, logger: ILog, saveDeploymentState) {

  if(!thisIsMe.state){
    throw newProgrammerOops("Missing state object on deployment action ! " + thisIsMe.origin)
  }
  if (thisIsMe.state?.modified) {
    if (actionExecutionOptions.dryRun && actionExecutionOptions.dryRunOutputDir) {
      const writePath = path.join(
        actionExecutionOptions.dryRunOutputDir,
        thisIsMe.operation + "-" + thisIsMe.identifier.toLowerCase() + ".yaml",
      )
      await writeFile(writePath, thisIsMe.descriptor.trim())
      return thisIsMe
    } else {
      try {
        const stdOut = await extendedExec(cmd)("kubectl", [thisIsMe.operation, "-f", "-"], {
          env: process.env,
          stdin: thisIsMe.descriptor,
          debug: true,
        })
        logger.info(
          "kubectl " +
          thisIsMe.operation +
          " deployments in " +
          thisIsMe.origin +
          "/" +
          thisIsMe.identifier,
        )
        logger.info(stdOut || "[empty output]")

        try {
          const state = await saveDeploymentState(thisIsMe)
          thisIsMe.state = state

          if (actionExecutionOptions.waitForRollout && thisIsMe.deploymentRollouts && thisIsMe.operation === "apply") {
            await Bluebird.all(thisIsMe.deploymentRollouts.map(async (deploymentRollout) => {
              const stdOut = await extendedExec(cmd)("kubectl", ["rollout", "status", deploymentRollout], {
                env: process.env,
                stdin: thisIsMe.descriptor,
                debug: true,
              })
              logger.info(deploymentRollout + " rolled out", stdOut)
            }))
          }

          return thisIsMe
        } catch (err) {
          throw "Failed to save state after successful deployment! " +
          thisIsMe.origin +
          "/" +
          thisIsMe.identifier +
          "\n" +
          err
        }
      } catch (error) {
        if (typeof error === "string") throw error
        const { errCode, stdOut, message: err } = error
        if (thisIsMe.operation === "delete") {
          logger.info(
            "kubectl " +
            thisIsMe.operation +
            " deployments in " +
            thisIsMe.origin +
            "/" +
            thisIsMe.identifier,
          )
          logger.info(
            "Error performing kubectl delete. Continuing anyway and updating deployment state as deleted. kubectl output follows.",
          )
          logger.info(err || "[empty error]")
          logger.info(stdOut || "[empty output]")

          // @ts-ignore
          thisIsMe.state.stdout = stdOut
          // @ts-ignore
          thisIsMe.state.stderr = err

          try {
            const state = await saveDeploymentState(thisIsMe)
            thisIsMe.state = state
            return thisIsMe
          } catch (err) {
            throw "Failed to save state after error in deleting deployment! " +
            thisIsMe.origin +
            "/" +
            thisIsMe.identifier +
            "\n" +
            err
          }
        } else {
          let message = "Failed to deploy from label for image " + JSON.stringify(thisIsMe)
          message += "\n" + err
          message += "\nCode:" + errCode
          message += "\nStdOut:" + stdOut
          throw message
        }
      }
    }
  } else {
    logger.debug(thisIsMe.identifier + " not modified, not deploying.")
    return thisIsMe
  }
}


function listDeploymentRollouts(descriptorsByKind) {
  return descriptorsByKind["Deployment"].map((deploymentDoc) => {
    return deploymentDoc.kind + "/" + deploymentDoc.metadata.name
  })
}

function expandEnvAndMustacheVariablesInFile(deploymentFileDescriptorContent: string) {
  let lines = deploymentFileDescriptorContent.split("\n")

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
  let modifiedContents = lines.join("\n")
  modifiedContents = expandTemplate(modifiedContents)
  return modifiedContents
}


export function createKubectlDeployAction(_origin: string, deploymentFileDescriptorContent: string, operation: string, logger: ILog, branchModificationParams?: TBranchModificationParams): TKubectrlDeployAction {
  let origin: string = _origin
  try {
    let finalDescriptor = expandEnvAndMustacheVariablesInFile(deploymentFileDescriptorContent)

    if (branchModificationParams && branchModificationParams.shouldModify) {
      finalDescriptor = modifyDeploymentDocument(finalDescriptor, branchModificationParams)
      origin = branchModificationParams.origin || _origin + "/branch!"
    }

    let deploymentDescriptor = applyClusterPolicies(finalDescriptor, logger)
    let loadedDescriptor = identifyDocument(deploymentDescriptor)

    let deploymentRollouts = []

    let descriptorsByKind = loadedDescriptor.descriptorsByKind
    if (Boolean(descriptorsByKind["Deployment"])) {
      deploymentRollouts = listDeploymentRollouts(descriptorsByKind)
    }

    let documentDeploymentAction: TKubectrlDeployAction = {
      async execute(deploymentOptions, cmd, logger, saveDeploymentState) {
        return executeDeploymentAction(documentDeploymentAction, deploymentOptions, cmd, logger, saveDeploymentState)
      },
      operation: operation,
      origin: origin,
      deploymentRollouts: deploymentRollouts,
      descriptor: deploymentDescriptor,
      identifier: loadedDescriptor.identifyingString,
      descriptorsByKind: loadedDescriptor.descriptorsByKind,
    }

    return documentDeploymentAction

  } catch (error) {
    let message = `In deployment descriptor, origin: ${origin}\n`
    message += error.message

    throw new Oops({ message, category: "OperationalError", cause: error })
  }
}

export function createKubectlTestDeployAction(serialisedAction: TKubectrlDeployAction) {
  let me = {
    execute(deploymentOptions, cmd, logger, saveDeploymentState) {
      return executeDeploymentAction(me, deploymentOptions, cmd, logger, saveDeploymentState)
    },
    testInstance: true,
    ...serialisedAction,
  }
  return me
}
