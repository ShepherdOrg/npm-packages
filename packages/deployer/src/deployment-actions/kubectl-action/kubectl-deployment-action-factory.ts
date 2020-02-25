import { identifyDocument, TDescriptorsByKind } from "./k8s-deployment-document-identifier"
import { TBranchModificationParams } from "./k8s-branch-deployment/create-name-change-index"
import {
  IKubectlDeployAction,
  ILog,
  IRollbackActionExecution,
  TActionExecutionOptions,
  TRollbackResult,
} from "../../deployment-types"
import { modifyDeploymentDocument } from "./k8s-branch-deployment/modify-deployment-document"
import { newProgrammerOops, Oops } from "oops-error"
import { expandEnv } from "../../template/expandenv"
import { processLine } from "../../template/base64-env-subst"
import { expandTemplate } from "../../template/expandtemplate"
import * as path from "path"
import { extendedExec, writeFile } from "../../helpers/promisified"
import { TK8sPartialDescriptor } from "./k8s-document-types"
import { emptyArray } from "../../helpers/ts-functions"
import { IExec, TFileSystemPath } from "../../helpers/basic-types"
import { IReleaseStateStore } from "@shepherdorg/state-store/dist"
import { isOops } from "../../helpers/isOops"

const applyClusterPolicies = require("./apply-k8s-policy").applyPoliciesToDoc

type IKubectlActionFactoryDependencies = { exec: IExec, logger: ILog, stateStore: IReleaseStateStore }

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
      message += error
      throw new Error(message)
    }
  })
  return lines.join("\n")
}


function expandEnvAndMustacheVariablesInFile(deploymentFileDescriptorContent: string) {
  return expandTemplate(expandEnvVariables(deploymentFileDescriptorContent.split("\n")))
}


export interface ICreateKubectlDeploymentAction {
  executeKubectlDeploymentAction: (thisIsMe: IKubectlDeployAction, actionExecutionOptions: TActionExecutionOptions) => Promise<IKubectlDeployAction>;
  createKubectlDeployAction: (origin: string, deploymentFileDescriptorContent: string, operation: string, fileName: TFileSystemPath, logger: ILog, branchModificationParams?: TBranchModificationParams) => IKubectlDeployAction
}

export function createKubectlDeploymentActionFactory({ exec, logger, stateStore }: IKubectlActionFactoryDependencies): ICreateKubectlDeploymentAction {

  async function executeKubectlDeploymentAction(thisIsMe: IKubectlDeployAction, actionExecutionOptions: TActionExecutionOptions) {

    if (!thisIsMe.state) {
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
          const stdOut = await extendedExec(exec)("kubectl", [thisIsMe.operation, "-f", "-"], {
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
            if(thisIsMe.isStateful){
              if(!thisIsMe.state){
                throw newProgrammerOops('Attempting to execute a stateful action without a state! ', thisIsMe)
              }
              thisIsMe.state = await stateStore.saveDeploymentState(thisIsMe.state)
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
            if (err) {
              logger.info(err || "[empty error]")
            }
            logger.info(stdOut || "[empty output]")

            // @ts-ignore
            thisIsMe.state.stdout = stdOut
            // @ts-ignore
            thisIsMe.state.stderr = err

            try {
              const state = await stateStore.saveDeploymentState(thisIsMe.state)
              thisIsMe.state = state
              return thisIsMe
            } catch (err) {
              throw new Error("Failed to save state after error in deleting deployment! " +
                thisIsMe.origin +
                "/" +
                thisIsMe.identifier +
                "\n" +
                err)
            }
          } else {
            if(isOops(error)){
              console.log(`We have an oops error!`, error.toString())
              console.log(error)
            }
            let message = `Failed to perform ${thisIsMe.operation} from label for image ${JSON.stringify(thisIsMe, null, 2)}`
            message += "\n" + error.message
            message += "\nCode:" + errCode
            message += "\nStdOut:" + stdOut
            throw new Error(message)
          }
        }
      }
    } else {
      logger.debug(thisIsMe.identifier + " not modified, not deploying.")
      return thisIsMe
    }
  }

  function createKubectlDeployAction(origin: string, deploymentFileDescriptorContent: string, operation: string, fileName: TFileSystemPath, logger: ILog, branchModificationParams?: TBranchModificationParams): IKubectlDeployAction {
    let actionOrigin: string = origin
    try {
      if (branchModificationParams && branchModificationParams.shouldModify) {
        process.env.BRANCH_NAME = branchModificationParams.branchName
        process.env.BRANCH_NAME_PREFIX = `${branchModificationParams.branchName}-`
        process.env.BRANCH_NAME_POSTFIX = `-${branchModificationParams.branchName}`
      } else {
        process.env.BRANCH_NAME = ""
        process.env.BRANCH_NAME_PREFIX = ""
        process.env.BRANCH_NAME_POSTFIX = ""
      }

      let finalDescriptor = expandEnvAndMustacheVariablesInFile(deploymentFileDescriptorContent)

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

      let documentDeploymentAction: IKubectlDeployAction & IRollbackActionExecution = {
        canRollbackExecution(): boolean {
          console.log(`canRollbackExecution, based on lastVersion`, documentDeploymentAction.state?.lastVersion)
          return Boolean(deploymentRollouts.length);
        },
        planString() {
          return `kubectl ${operation} ${loadedDescriptor.identifyingString}`
        },
        async execute(deploymentOptions: TActionExecutionOptions) {
          return await executeKubectlDeploymentAction(documentDeploymentAction, deploymentOptions)
        },
        async rollback() : Promise<TRollbackResult>{
          return await Promise.all(deploymentRollouts.map((deploymentRollout)=>{
            return extendedExec(exec)("kubectl", ["--namespace", deploymentRollout.namespace, "rollout", "undo", `deployment/${deploymentRollout.deploymentName}`], {
              env: process.env,
              debug: true,
            }).then((stdOut) => {
              logger.info(stdOut)
              logger.info("Rollback complete. Original error follows.")
              return {
                stdOut: stdOut
              }
            }).catch((execError) => {
              const { errCode, stdOut, message: err } = execError
              logger.warn(`Error executing kubectl rollout undo ${deploymentRollout}, code ${errCode}`)
              logger.warn(err)
              logger.warn(stdOut)
              return {
                code: errCode,
                stdOut: stdOut,
                stdErr: err
              }
            })
          })).then((allResults)=>{
            return {

            }

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
        type: "kubectl"
      }


      return documentDeploymentAction

    } catch (error) {
      let message = `In deployment descriptor, origin: ${actionOrigin}\n`
      message += error.message

      throw new Oops({ message, category: "OperationalError", cause: error })
    }
  }


  return {
    executeKubectlDeploymentAction,
    createKubectlDeployAction,
  }
}





