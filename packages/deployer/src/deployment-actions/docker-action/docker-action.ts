import {
  IDockerExecutableAction,
  ILog,
  IRollbackActionExecution,
  TActionExecutionOptions,
} from "../../deployment-types"
import { expandEnv } from "../../template/expandenv"
import { expandTemplate } from "../../template/expandtemplate"
import { TEnvironmentVariables, TImageMetadata } from "@shepherdorg/metadata"
import * as path from "path"
import { extendedExec, writeFile } from "../../helpers/promisified"
import { environmentToEnvSetters } from "./environment-to-env-setters"
import { IReleaseStateStore } from "@shepherdorg/state-store"
import { newOperationalOops, newProgrammerOops } from "oops-error"
import { isOops } from "../../helpers/isOops"

type TDockerActionFactoryDependencies = {
  exec: any;
  logger: ILog;
  stateStore: IReleaseStateStore
}


export interface ICreateDockerActions {
  createDockerExecutionAction: (shepherdMetadata: TImageMetadata,
                                dockerImageUrl: string,
                                displayName: string,
                                herdKey: string,
                                command: string,
                                environment: TEnvironmentVariables,
                                environmentVariablesExpansionString?: string) => IDockerExecutableAction;

  executeDockerAction: (executableAction: IDockerExecutableAction, deploymentOptions: TActionExecutionOptions) => Promise<IDockerExecutableAction>
}

export function createDockerActionFactory({ exec, logger, stateStore }: TDockerActionFactoryDependencies): ICreateDockerActions {

  async function executeDockerAction(
    executableAction: IDockerExecutableAction,
    deploymentOptions: TActionExecutionOptions,
  ) {
    function dockerArguments() {
      return ["run"].concat(executableAction.dockerParameters)
    }

    if (deploymentOptions.dryRun && deploymentOptions.dryRunOutputDir) {
      let writePath = path.join(
        deploymentOptions.dryRunOutputDir,
        executableAction.imageWithoutTag?.replace(/\//g, "_") + "-deployer.txt",
      )

      let cmdLine = `docker run ${executableAction.forTestParameters?.join(" ")}`

      await writeFile(writePath, cmdLine)
      return executableAction
    } else {
      try {
        const stdout = await extendedExec(exec)("docker", dockerArguments(), {
          env: process.env,
        })
        // logger.enterDeployment(plan.origin + '/' + plan.identifier);
        logger.info(executableAction.planString())
        logger.info(stdout)
        // logger.exitDeployment(plan.origin + '/' + plan.identifier);

        try {
          if (executableAction.isStateful && executableAction.state) {
            executableAction.state = await stateStore.saveDeploymentState(executableAction.state)
          }
          return executableAction
        } catch (err) {
          // noinspection ExceptionCaughtLocallyJS
          throw new Error(
            "Failed to save state after successful deployment! " +
            executableAction.origin +
            "/" +
            executableAction.identifier +
            "\n" +
            err,
          )
        }
      } catch (err) {
        let message = "Failed to run docker " + dockerArguments().join(" ") + ": \n"
        message += "Error message: " + err.message || err
        if(isOops(err)){
          throw newProgrammerOops(message, err.context, err)
        } else{
          throw newProgrammerOops(message, )
        }
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
    environmentVariablesExpansionString?: string,
  ): IDockerExecutableAction {
    let operation = "run"

    const deploymentAction: IDockerExecutableAction = {
      descriptor: "",
      dockerParameters: ["-i", "--rm"],
      forTestParameters: undefined,
      imageWithoutTag: dockerImageUrl.replace(/:.*/g, ""), // For regression testing
      origin: herdKey,
      operation: operation,
      isStateful: true,
      command: command,
      identifier: herdKey,
      planString(): string {
        return `docker ${operation} ${dockerImageUrl} ${command}`
      },
      async execute(
        actionExecutionOptions: TActionExecutionOptions,
      ): Promise<IDockerExecutableAction> {
        return await executeDockerAction(deploymentAction, actionExecutionOptions)
      },
      canRollbackExecution(): boolean {
        return false
      }
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
      deploymentAction.dockerParameters.push(deploymentAction.command)
      deploymentAction.forTestParameters.push(deploymentAction.command)
    }

    deploymentAction.descriptor = allButImageParameter(deploymentAction.dockerParameters).join(" ")
    return deploymentAction
  }


  return {
    executeDockerAction,
    createDockerExecutionAction,
  }
}


