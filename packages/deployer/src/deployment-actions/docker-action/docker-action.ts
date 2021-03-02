import { IDockerExecutableAction, TActionExecutionOptions } from "../../deployment-types"
import { expandEnv } from "../../template/expandenv"
import { expandTemplate } from "@shepherdorg/hbs-template"
import { TEnvironmentVariables, TImageMetadata } from "@shepherdorg/metadata"
import * as path from "path"
import { writeFile } from "../../helpers/promisified"
import { environmentToEnvSetters } from "./environment-to-env-setters"
import { IReleaseStateStore } from "@shepherdorg/state-store"
import { newProgrammerOops } from "oops-error"
import { isOops } from "../../helpers/isOops"
import { ILog } from "@shepherdorg/logger"
import * as chalk from "chalk"
import { TDeploymentState } from "@shepherdorg/metadata"
import { FExec } from "@shepherdorg/ts-exec"

type TDockerActionFactoryDependencies = {
  exec: FExec
  logger: ILog
  stateStore: IReleaseStateStore
}

export interface ICreateDockerActions {
  createDockerExecutionAction: (
    shepherdMetadata: TImageMetadata,
    dockerImageUrl: string,
    displayName: string,
    herdKey: string,
    command: string,
    environment: TEnvironmentVariables,
    environmentVariablesExpansionString?: string
  ) => IDockerExecutableAction

  executeDockerAction: (
    executableAction: IDockerExecutableAction,
    deploymentOptions: TActionExecutionOptions
  ) => Promise<IDockerExecutableAction>
}

function removeTagFromImageUrl(dockerImageUrl: string) {
  const indexOfSlash = Math.max(dockerImageUrl.indexOf("/"), 0)
  const indexOfColonAfterSlash = dockerImageUrl.slice(indexOfSlash).indexOf(":")
  if (indexOfColonAfterSlash > 0) {
    let reducedUrl = dockerImageUrl.slice(0, indexOfSlash + indexOfColonAfterSlash)
    return reducedUrl
  }
  return dockerImageUrl
}

export function createDockerActionFactory({
  exec,
  logger,
  stateStore,
}: TDockerActionFactoryDependencies): ICreateDockerActions {
  async function executeDockerAction(
    executableAction: IDockerExecutableAction,
    deploymentOptions: TActionExecutionOptions
  ) {
    function dockerArguments() {
      return ["run"].concat(executableAction.dockerParameters)
    }

    if (deploymentOptions.dryRun && deploymentOptions.dryRunOutputDir) {
      let writePath = path.join(
        deploymentOptions.dryRunOutputDir,
        executableAction.imageWithoutTag?.replace(/\//g, "_") + "-deployer.txt"
      )
      let cmdLine = `docker run ${executableAction.forTestParameters?.join(" ")}`
      logger.info(`Writing deployment command to ${writePath}`, deploymentOptions.logContext)
      await writeFile(writePath, cmdLine)
      return executableAction
    } else {
      const execResult = await exec("docker", dockerArguments(), {
        env: process.env,
      })
      // logger.enterDeployment(plan.origin + '/' + plan.identifier);
      logger.info(executableAction.planString(), deploymentOptions.logContext)
      logger.info(execResult.stdout, deploymentOptions.logContext)
      // logger.exitDeployment(plan.origin + '/' + plan.identifier);
      try {
        let deploymentState = executableAction.getActionDeploymentState()
        if (executableAction.isStateful && deploymentState) {
          executableAction.setActionDeploymentState(await stateStore.saveDeploymentState(deploymentState))
        }
        return executableAction
      } catch (err) {
        // noinspection ExceptionCaughtLocallyJS
        throw new Error(
          `Failed to save state after successful deployment! ${chalk.blueBright(
            executableAction.origin
          )}/${chalk.blueBright(executableAction.identifier)}
${err.message}`
        )
      }
    }
  }

  function createDockerExecutionAction(
    shepherdMetadata: TImageMetadata,
    dockerImageUrl: string,
    displayName: string,
    herdKey: string,
    command: string,
    environment: TEnvironmentVariables,
    environmentVariablesExpansionString?: string
  ): IDockerExecutableAction {
    let operation = "run"

    let deploymentState: TDeploymentState | undefined = undefined

    const deploymentAction: IDockerExecutableAction = {
      descriptor: "",
      dockerParameters: ["-i", "--rm"],
      forTestParameters: undefined,
      imageWithoutTag: removeTagFromImageUrl(dockerImageUrl),
      origin: herdKey,
      operation: operation,
      isStateful: true,
      command: command,
      identifier: herdKey,
      getActionDeploymentState(): TDeploymentState | undefined {
        return deploymentState
      },
      setActionDeploymentState(newState?: TDeploymentState): void {
        deploymentState = newState
      },
      planString(): string {
        return `docker ${operation} ${dockerImageUrl} ${command}`
      },
      async execute(actionExecutionOptions: TActionExecutionOptions): Promise<IDockerExecutableAction> {
        return await executeDockerAction(deploymentAction, actionExecutionOptions)
      },
      canRollbackExecution(): boolean {
        return false
      },
    }

    function allButImageParameter(params: string[]) {
      return params.slice(0, params.length - 1)
    }

    let envList = [expandTemplate("ENV={{ ENV }}")]

    if (environmentVariablesExpansionString) {
      const envLabel = expandEnv(environmentVariablesExpansionString)
      envList = envList.concat(envLabel.split(","))
    }
    if (environment) {
      envList = environmentToEnvSetters(envList, environment)
    }

    envList.forEach(function(env_item) {
      deploymentAction.dockerParameters.push("-e")
      deploymentAction.dockerParameters.push(env_item)
    })

    deploymentAction.forTestParameters = deploymentAction.dockerParameters.slice(0) // Clone array

    deploymentAction.dockerParameters.push(dockerImageUrl)
    deploymentAction.forTestParameters.push(deploymentAction.imageWithoutTag + ":[image_version]")

    if (deploymentAction.command) {
      let commandParts = deploymentAction.command.split(/\s+/)
      commandParts.forEach(splitPart => deploymentAction.dockerParameters.push(splitPart))
      if (deploymentAction.forTestParameters) {
        // @ts-ignore
        commandParts.forEach(splitPart => deploymentAction.forTestParameters.push(splitPart))
      }
    }

    deploymentAction.descriptor = allButImageParameter(deploymentAction.dockerParameters).join(" ")
    return deploymentAction
  }

  return {
    executeDockerAction,
    createDockerExecutionAction,
  }
}
