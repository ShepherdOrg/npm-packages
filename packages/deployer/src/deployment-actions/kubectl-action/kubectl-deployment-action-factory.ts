import { identifyDocument, TDescriptorsByKind } from "./k8s-deployment-document-identifier"
import { TBranchModificationParams } from "./k8s-branch-deployment/create-name-change-index"
import {
  IKubectlDeployAction,
  ICanRollbackActionExecution,
  TActionExecutionOptions,
  TRollbackResult,
} from "../../deployment-types"
import { newProgrammerOops, Oops } from "oops-error"
import { expandEnv } from "../../template/expandenv"
import { processLine } from "../../template/base64-env-subst"
import { expandTemplate } from "@shepherdorg/hbs-template"
import * as path from "path"
import { writeFile } from "../../helpers/promisified"
import { TK8sPartialDescriptor } from "./k8s-document-types"
import { emptyArray } from "../../helpers/ts-functions"
import { TFileSystemPath } from "../../helpers/basic-types"
import { IReleaseStateStore } from "@shepherdorg/state-store/dist"
import { ILog } from "../../logging/logger"
import { TDeploymentState } from "@shepherdorg/metadata"
import { modifyDeploymentDocument } from "./k8s-branch-deployment/modify-deployment-document"
import { createRolloutUndoActionFactory } from "./rollout-undo-actionfactory"
import { FExec } from "@shepherdorg/ts-exec"

const chalk = require("chalk")

const applyClusterPolicies = require("./apply-k8s-policy").applyPoliciesToDoc

type IKubectlActionFactoryDependencies = { exec: FExec; logger: ILog; stateStore: IReleaseStateStore }

export type TDeploymentRollout = {
  namespace: string
  deploymentKind: string
  deploymentName: string
}

function listDeploymentRollouts(descriptorsByKind: TDescriptorsByKind): Array<TDeploymentRollout> {
  return descriptorsByKind["Deployment"].map((deploymentDoc: TK8sPartialDescriptor) => {
    return {
      deploymentKind: deploymentDoc.kind || "Deployment",
      deploymentName: deploymentDoc.metadata.name || "",
      namespace: deploymentDoc.metadata.namespace || "default",
    }
  })
}

function expandEnvVariables(lines: string[]) {
  lines.forEach(function(line, idx) {
    try {
      lines[idx] = expandEnv(line)
      lines[idx] = processLine(lines[idx], {})
    } catch (error) {
      let message = `Error expanding variables in line #${idx}: ${line}\n`
      message += error.message || error
      throw new Error(message)
    }
  })
  return lines.join("\n")
}

export function expandEnvAndMustacheVariablesInFile(deploymentFileDescriptorContent: string) {
  return expandTemplate(expandEnvVariables(deploymentFileDescriptorContent.split("\n")))
}

export interface ICreateKubectlDeploymentAction {
  executeKubectlDeploymentAction: (
    thisIsMe: IKubectlDeployAction,
    actionExecutionOptions: TActionExecutionOptions
  ) => Promise<IKubectlDeployAction>
  createKubectlDeployAction: (
    origin: string,
    deploymentFileDescriptorContent: string,
    operation: string,
    fileName: TFileSystemPath,
    branchModificationParams?: TBranchModificationParams
  ) => IKubectlDeployAction
}

export function createKubectlDeploymentActionsFactory({
  exec,
  logger,
  stateStore,
}: IKubectlActionFactoryDependencies): ICreateKubectlDeploymentAction {
  /* We might want to inject the rollout undo action factory at some point. Not worth the hassle right now. */
  let rolloutUndoActionFactory = createRolloutUndoActionFactory({ exec: exec, logger })

  async function executeKubectlDeploymentAction(
    thisIsMe: IKubectlDeployAction,
    actionExecutionOptions: TActionExecutionOptions
  ) {
    let deploymentState = thisIsMe.getActionDeploymentState()
    if (!deploymentState) {
      throw newProgrammerOops("Missing state object on deployment action ! " + thisIsMe.origin)
    }
    if (deploymentState?.modified) {
      if (actionExecutionOptions.dryRun && actionExecutionOptions.dryRunOutputDir) {
        const writePath = path.join(
          actionExecutionOptions.dryRunOutputDir,
          thisIsMe.operation + "-" + thisIsMe.identifier.toLowerCase() + ".yaml"
        )
        logger.info(`Writing deployment file to ${writePath}`, actionExecutionOptions.logContext)
        await writeFile(writePath, thisIsMe.descriptor.trim())
        return thisIsMe
      } else {
        try {
          const execResult = await exec(
            "kubectl",
            [thisIsMe.operation, "-f", "-"],
            {
              env: process.env,
              stdin: thisIsMe.descriptor,
            },
            logger
          )
          logger.info(
            `kubectl ${thisIsMe.operation} descriptors in ${thisIsMe.origin}/${thisIsMe.identifier}`,
            actionExecutionOptions.logContext
          )
          logger.info((execResult.stdout as string) || "[empty output]", actionExecutionOptions.logContext)

          try {
            if (thisIsMe.isStateful) {
              if (!deploymentState) {
                throw newProgrammerOops("Attempting to execute a stateful action without a state! ", thisIsMe)
              }
              thisIsMe.setActionDeploymentState(await stateStore.saveDeploymentState(deploymentState))
            }

            return thisIsMe
          } catch (err) {
            throw "Failed to save state after successful kubectl deployment! " +
              thisIsMe.origin +
              "/" +
              thisIsMe.identifier +
              "\n" +
              err
          }
        } catch (error) {
          if (typeof error === "string") throw new Error(error)
          const { code, stdout, stderr, message: err } = error
          if (thisIsMe.operation === "delete") {
            logger.info(
              "kubectl " + thisIsMe.operation + " deployments in " + thisIsMe.origin + "/" + thisIsMe.identifier,
              actionExecutionOptions.logContext
            )
            logger.info(
              "Error performing kubectl delete. Continuing anyway and updating deployment state as deleted. kubectl output follows.",
              actionExecutionOptions.logContext
            )
            if (err) {
              logger.info(err || "[empty error]", actionExecutionOptions.logContext)
            }
            logger.info(stdout || "[empty output]", actionExecutionOptions.logContext)

            deploymentState.stdout = stdout
            deploymentState.stderr = stderr

            try {
              const state = await stateStore.saveDeploymentState(deploymentState)

              thisIsMe.setActionDeploymentState(state)
              return thisIsMe
            } catch (err) {
              throw new Error(`Failed to save state after error in deleting deployment! ${chalk.blueBright(
                `${thisIsMe.origin}/${thisIsMe.identifier}`
              )}
${err.message || err}`)
            }
          } else {
            let message = `Failed to perform ${chalk.blueBright(
              thisIsMe.operation
            )} from label for image ${JSON.stringify(thisIsMe, null, 2)}`
            message += "\n" + error.message
            message += "\nCode:" + code
            message += "\nStdOut:" + stdout
            throw new Error(message)
          }
        }
      }
    } else {
      logger.debug(thisIsMe.identifier + " not modified, not deploying.")
      return thisIsMe
    }
  }

  function createKubectlDeployAction(
    origin: string,
    deploymentFileDescriptorContent: string,
    operation: string,
    fileName: TFileSystemPath,
    branchModificationParams?: TBranchModificationParams
  ): IKubectlDeployAction {
    let actionOrigin: string = origin
    try {
      let finalDescriptor = deploymentFileDescriptorContent

      if (branchModificationParams && branchModificationParams.shouldModify) {
        finalDescriptor = modifyDeploymentDocument(finalDescriptor, branchModificationParams)
        actionOrigin = branchModificationParams.origin || origin + "/branch!"
      }

      let deploymentDescriptor = applyClusterPolicies(finalDescriptor, logger)
      let loadedDescriptor = identifyDocument(deploymentDescriptor)

      let deploymentRollouts = emptyArray<TDeploymentRollout>()

      let descriptorsByKind = loadedDescriptor.descriptorsByKind
      if (Boolean(descriptorsByKind["Deployment"])) {
        deploymentRollouts = listDeploymentRollouts(descriptorsByKind)
      }

      let deploymentState: TDeploymentState | undefined

      let documentDeploymentAction: IKubectlDeployAction & ICanRollbackActionExecution = {
        getActionDeploymentState(): TDeploymentState | undefined {
          return deploymentState
        },
        setActionDeploymentState(newState: TDeploymentState | undefined): void {
          deploymentState = newState
        },
        canRollbackExecution(): boolean {
          return Boolean(deploymentRollouts.length)
        },
        planString() {
          return `kubectl ${operation} ${loadedDescriptor.identifyingString}`
        },
        async execute(deploymentOptions: TActionExecutionOptions) {
          return await executeKubectlDeploymentAction(documentDeploymentAction, deploymentOptions)
        },
        async rollback(deploymentOptions: TActionExecutionOptions): Promise<TRollbackResult> {
          /* Rollback actions on rollout wait failure also. */
          return await Promise.all(
            deploymentRollouts.map((deploymentRollout: TDeploymentRollout) => {
              return rolloutUndoActionFactory.createRolloutUndoAction(deploymentRollout).execute(deploymentOptions)
            })
          ).then(allResults => {
            let returnCodes = allResults.map(result => {
              return result.code
            })
            return { code: Math.max(...returnCodes) }
          })
        },
        operation: operation,
        isStateful: true,
        origin: actionOrigin,
        deploymentRollouts: deploymentRollouts,
        descriptor: deploymentDescriptor,
        fileName,
        identifier: loadedDescriptor.identifyingString,
        descriptorsByKind: loadedDescriptor.descriptorsByKind,
        type: "kubectl",
      }

      return documentDeploymentAction
    } catch (error) {
      let message = `In deployment descriptor, origin: ${chalk.blueBright(actionOrigin)}\n`
      message += error.message

      throw new Oops({ message, category: "OperationalError", cause: error })
    }
  }

  return {
    executeKubectlDeploymentAction,
    createKubectlDeployAction,
  }
}
