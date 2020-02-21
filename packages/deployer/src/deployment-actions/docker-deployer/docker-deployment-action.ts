import {
  IDockerDeploymentAction,
  IDockerExecutableAction,
  ILog,
  TActionExecutionOptions,
  TDeploymentOptions,
  TImageInformation,
} from "../../deployment-types"
import { expandEnv } from "../../template/expandenv"
import { expandTemplate } from "../../template/expandtemplate"
import { TDeployerMetadata, TDeploymentState, TEnvironmentVariables, TImageMetadata } from "@shepherdorg/metadata"
import * as path from "path"
import { extendedExec, writeFile } from "../../helpers/promisified"
import { environmentToEnvSetters } from "./environment-to-env-setters"

export async function executeDockerAction(
  deployerAction: IDockerExecutableAction,
  deploymentOptions: TActionExecutionOptions,
  cmd: any,
  logger: ILog,
  saveDeploymentState: (stateSignatureObject: any) => Promise<TDeploymentState>
): Promise<IDockerExecutableAction> {
  if (deploymentOptions.dryRun && deploymentOptions.dryRunOutputDir) {
    let writePath = path.join(
      deploymentOptions.dryRunOutputDir,
      deployerAction.imageWithoutTag?.replace(/\//g, "_") + "-deployer.txt"
    )

    let cmdLine = `docker run ${deployerAction.forTestParameters?.join(" ")}`

    await writeFile(writePath, cmdLine)
    return deployerAction
  } else {
    try {
      const stdout = await extendedExec(cmd)("docker", ["run"].concat(deployerAction.dockerParameters), {
        env: process.env,
      })
      // logger.enterDeployment(plan.origin + '/' + plan.identifier);
      logger.info(deployerAction.planString())
      logger.info(stdout)
      // logger.exitDeployment(plan.origin + '/' + plan.identifier);

      try {
        deployerAction.state = await saveDeploymentState(deployerAction)
        return deployerAction
      } catch (err) {
        // noinspection ExceptionCaughtLocallyJS
        throw new Error(
          "Failed to save state after successful deployment! " +
            deployerAction.origin +
            "/" +
            deployerAction.identifier +
            "\n" +
            err
        )
      }
    } catch (err) {
      let message = "Failed to run docker action " + deployerAction.descriptor + ": \n"
      message += err.message || err
      throw new Error(message)
    }
  }
}

export function createDockerExecutionAction(
  shepherdMetadata: TImageMetadata,
  dockerImageUrl: string,
  displayName: string,
  herdKey: string,
  command: string,
  environment: TEnvironmentVariables,
  environmentVariablesExpansionString?: string
): IDockerExecutableAction {
  let operation = "run"
  const deploymentAction: IDockerExecutableAction = {
    descriptor: "",
    dockerParameters: ["-i", "--rm"],
    forTestParameters: undefined,
    imageWithoutTag: dockerImageUrl.replace(/:.*/g, ""), // For regression testing
    origin: herdKey,
    operation: operation,
    pushToUI: true,
    command: command,
    identifier: herdKey,
    planString(): string {
      return `docker ${operation} ${dockerImageUrl} ${command}`
    },
    async execute(
      deploymentOptions: TDeploymentOptions & { waitForRollout: boolean; pushToUi: boolean },
      cmd: any,
      logger: ILog,
      saveDeploymentState: (stateSignatureObject: any) => Promise<TDeploymentState>
    ): Promise<IDockerExecutableAction> {
      return await executeDockerAction(deploymentAction, deploymentOptions, cmd, logger, saveDeploymentState)
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
    deploymentAction.dockerParameters.push(deploymentAction.command)
    deploymentAction.forTestParameters.push(deploymentAction.command)
  }

  deploymentAction.descriptor = allButImageParameter(deploymentAction.dockerParameters).join(" ")
  return deploymentAction
}

export async function createDockerDeploymentActions(
  imageInformation: TImageInformation
): Promise<Array<IDockerDeploymentAction>> {
  let deployerMetadata = imageInformation.shepherdMetadata as TDeployerMetadata
  const executionAction = createDockerExecutionAction(
    deployerMetadata,
    imageInformation.imageDeclaration.dockerImage ||
      imageInformation.imageDeclaration.image + ":" + imageInformation.imageDeclaration.imagetag,
    imageInformation.shepherdMetadata?.displayName || "",
    imageInformation.imageDeclaration.key,
    deployerMetadata.deployCommand || "deploy",
    deployerMetadata.environment,
    deployerMetadata.environmentVariablesExpansionString
  )

  const deploymentAction = {
    ...{
      herdKey: imageInformation.imageDeclaration.key,
      type: "deployer",
      herdDeclaration: imageInformation.imageDeclaration,
      metadata: deployerMetadata,
      displayName: imageInformation.shepherdMetadata?.displayName || "",
      env: imageInformation.env,
    },
    ...executionAction,
  }

  return [deploymentAction]
}
