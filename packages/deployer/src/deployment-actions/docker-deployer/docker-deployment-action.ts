import {
  ILog,
  TActionExecutionOptions,
  TDeploymentOptions,
  IDockerDeploymentAction,
  TImageInformation,
} from "../../deployment-types"
import { expandEnv } from "../../template/expandenv"
import { expandTemplate } from "../../template/expandtemplate"
import { TNamedValue } from "../../helpers/basic-types"
import { TDeployerMetadata } from "@shepherdorg/metadata"
import { TDeploymentState } from "@shepherdorg/metadata"
import * as path from "path"
import { extendedExec, writeFile } from "../../helpers/promisified"

export async function executeDeployerAction(deployerAction: IDockerDeploymentAction, deploymentOptions: TActionExecutionOptions, cmd: any, logger: ILog, saveDeploymentState: (stateSignatureObject: any) => Promise<TDeploymentState>): Promise<IDockerDeploymentAction> {
  if (deploymentOptions.dryRun && deploymentOptions.dryRunOutputDir) {
    let writePath = path.join(
      deploymentOptions.dryRunOutputDir,
      deployerAction.imageWithoutTag?.replace(/\//g, "_") + "-deployer.txt",
    )

    let cmdLine = `docker run ${deployerAction.forTestParameters?.join(" ")}`

    await writeFile(writePath, cmdLine)
    return deployerAction
  } else {
    try {
      const stdout = await extendedExec(cmd)("docker", ["run"].concat(deployerAction.dockerParameters), {
        env: process.env,
      })
      try {
        // logger.enterDeployment(plan.origin + '/' + plan.identifier);
        logger.info(stdout)
        // logger.exitDeployment(plan.origin + '/' + plan.identifier);

        try {
          const state = await saveDeploymentState(deployerAction)
          deployerAction.state = state
          return deployerAction
        } catch (err) {
          // noinspection ExceptionCaughtLocallyJS
          throw new Error("Failed to save state after successful deployment! " +
            deployerAction.origin +
            "/" +
            deployerAction.identifier +
            "\n" +
            err)
        }
      } catch (e) {
        console.error("Error running docker run" + JSON.stringify(deployerAction))
        throw e
      }
    } catch (err) {
      let message = "Failed to run docker deployer " + JSON.stringify(deployerAction)
      message += err
      throw message
    }
  }
}

export async function calculateDeployerAction(imageInformation: TImageInformation): Promise<Array<IDockerDeploymentAction>> {

  const shepherdMetadata = imageInformation.shepherdMetadata  as TDeployerMetadata
  const herdKey: string = imageInformation.imageDefinition.key
  const displayName: string = imageInformation.shepherdMetadata?.displayName || ''

  let dockerImageWithVersion =
    imageInformation.imageDefinition.dockerImage ||
    imageInformation.imageDefinition.image + ":" + imageInformation.imageDefinition.imagetag

  const deploymentAction: IDockerDeploymentAction = {
    descriptor: "", // TODO: Validate descriptor use here
    env: imageInformation.env,
    displayName: displayName,
    metadata: shepherdMetadata as TDeployerMetadata,
    herdDeclaration: imageInformation.imageDefinition,
    dockerParameters: ["-i", "--rm"],
    forTestParameters: undefined,
    imageWithoutTag: dockerImageWithVersion.replace(/:.*/g, ""), // For regression testing
    origin: herdKey,
    type: "deployer",
    operation: "run",
    command: "deploy",
    identifier: herdKey,
    herdKey: herdKey,
    async execute(deploymentOptions: TDeploymentOptions & { waitForRollout: boolean; pushToUi: boolean }, cmd: any, logger: ILog, saveDeploymentState: (stateSignatureObject: any) => Promise<TDeploymentState>): Promise<IDockerDeploymentAction> {
      return await executeDeployerAction(deploymentAction, deploymentOptions, cmd, logger, saveDeploymentState)
    }
  }

  function allButImageParameter(params: string[]) {
    return params.slice(0, params.length - 1)
  }



  let envList = ["ENV={{ ENV }}"]

  deploymentAction.command = shepherdMetadata.deployCommand || deploymentAction.command
  if (shepherdMetadata.environmentVariablesExpansionString) {
    const envLabel = expandEnv(shepherdMetadata.environmentVariablesExpansionString)
    envList = envList.concat(envLabel.split(","))
  }
  if (shepherdMetadata.environment) {
    envList = envList.concat(shepherdMetadata.environment.map((value:TNamedValue<string>) => `${value.name}=${value.value}`))
  }

  envList.forEach(function(env_item) {
    deploymentAction.dockerParameters.push("-e")
    deploymentAction.dockerParameters.push(expandTemplate(env_item))
  })

  deploymentAction.forTestParameters = deploymentAction.dockerParameters.slice(0) // Clone array

  deploymentAction.dockerParameters.push(dockerImageWithVersion)
  deploymentAction.forTestParameters.push(deploymentAction.imageWithoutTag + ":[image_version]")

  if (deploymentAction.command) {
    deploymentAction.dockerParameters.push(deploymentAction.command)
    deploymentAction.forTestParameters.push(deploymentAction.command)
  }

  deploymentAction.descriptor = allButImageParameter(deploymentAction.dockerParameters).join(" ")

  return [deploymentAction]
}
