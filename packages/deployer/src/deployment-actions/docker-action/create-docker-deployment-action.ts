import { IDockerDeploymentAction, TImageInformation } from "../../deployment-types"
import { TDeployerMetadata } from "@shepherdorg/metadata"

export function createDockerDeploymentActionFactory(executionActionFactory: any) {

  async function createDockerDeploymentAction(
    imageInformation: TImageInformation,
  ): Promise<Array<IDockerDeploymentAction>> {
    let deployerMetadata = imageInformation.shepherdMetadata as TDeployerMetadata

    const executionAction = executionActionFactory.createDockerExecutionAction(
      deployerMetadata,
      imageInformation.imageDeclaration.dockerImage ||
      imageInformation.imageDeclaration.image + ":" + imageInformation.imageDeclaration.imagetag,
      imageInformation.shepherdMetadata?.displayName || "",
      imageInformation.imageDeclaration.key,
      deployerMetadata.deployCommand || "deploy",
      deployerMetadata.environment,
      deployerMetadata.environmentVariablesExpansionString,
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


  return {
    createDockerDeploymentAction
  }
}
