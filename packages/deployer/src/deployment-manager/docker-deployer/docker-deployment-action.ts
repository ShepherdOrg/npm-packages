import { TImageDeploymentAction } from "../deployment-types"
import { expandEnv } from "../../expandenv"
import { expandTemplate } from "../../expandtemplate"

export async function calculateDeployerAction(imageInformation): Promise<Array<TImageDeploymentAction>> {

  const shepherdMetadata = imageInformation.shepherdMetadata
  const herdKey: string = imageInformation.imageDefinition.key
  const displayName: string = imageInformation.shepherdMetadata.displayName

  let dockerImageWithVersion =
    imageInformation.imageDefinition.dockerImage ||
    imageInformation.imageDefinition.image + ":" + imageInformation.imageDefinition.imagetag

  const plan: TImageDeploymentAction = {
    displayName: displayName,
    metadata: shepherdMetadata,
    herdSpec: imageInformation.imageDefinition,
    dockerParameters: ["-i", "--rm"],
    forTestParameters: undefined,
    imageWithoutTag: dockerImageWithVersion.replace(/:.*/g, ""), // For regression testing
    origin: herdKey,
    type: "deployer",
    operation: "run",
    command: "deploy",
    identifier: herdKey,
    herdKey: herdKey,
  }

  let envList = ["ENV={{ ENV }}"]

  plan.command = shepherdMetadata.deployCommand || plan.command
  if (shepherdMetadata.environmentVariablesExpansionString) {
    const envLabel = expandEnv(shepherdMetadata.environmentVariablesExpansionString)
    envList = envList.concat(envLabel.split(","))
  }
  if (shepherdMetadata.environment) {
    envList = envList.concat(shepherdMetadata.environment.map(value => `${value.name}=${value.value}`))
  }

  envList.forEach(function(env_item) {
    plan.dockerParameters.push("-e")
    plan.dockerParameters.push(expandTemplate(env_item))
  })

  plan.forTestParameters = plan.dockerParameters.slice(0) // Clone array

  plan.dockerParameters.push(dockerImageWithVersion)
  plan.forTestParameters.push(plan.imageWithoutTag + ":[image_version]")

  if (plan.command) {
    plan.dockerParameters.push(plan.command)
    plan.forTestParameters.push(plan.command)
  }
  return [plan]
}
