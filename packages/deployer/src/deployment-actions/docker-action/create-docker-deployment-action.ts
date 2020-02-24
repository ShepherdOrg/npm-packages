import {
  IDockerDeploymentAction, ILog,
  IRollbackActionExecution,
  TImageInformation,
  TRollbackResult,
} from "../../deployment-types"
import { TDeployerMetadata } from "@shepherdorg/metadata"
import { ICreateDockerActions } from "./docker-action"

type TDockerDeploymentActionFactoryParams = {
  executionActionFactory: ICreateDockerActions,
  logger: ILog
}

export function createDockerDeploymentActionFactory({ executionActionFactory,logger }: TDockerDeploymentActionFactoryParams) {

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

    let deploymentAction = {
      ...{
        herdKey: imageInformation.imageDeclaration.key,
        type: "deployer",
        herdDeclaration: imageInformation.imageDeclaration,
        metadata: deployerMetadata,
        displayName: imageInformation.shepherdMetadata?.displayName || "",
        env: imageInformation.env,
        version: imageInformation.imageDeclaration.imagetag,
      },
      ...executionAction,
    }

    if (deployerMetadata.rollbackCommand) {

      const rollbackAction = executionActionFactory.createDockerExecutionAction(
        deployerMetadata,
        imageInformation.imageDeclaration.dockerImage ||
        imageInformation.imageDeclaration.image + ":" + imageInformation.imageDeclaration.imagetag,
        `${imageInformation.shepherdMetadata?.displayName || ""} rollback`,
        imageInformation.imageDeclaration.key,
        deployerMetadata.rollbackCommand,
        deployerMetadata.environment,
        deployerMetadata.environmentVariablesExpansionString,
      )


      const rollbackExecution: IRollbackActionExecution = {
        rollback(): TRollbackResult {
          // TODO Push old state to UI
          logger.info(`Executing docker action rollback`, rollbackAction.planString())
          return rollbackAction.execute({ pushToUi: false, dryRun: false, waitForRollout: false, dryRunOutputDir:"" }).then(() => {
            logger.info(`Rollback complete. Original error follows.`)
            return {}
          })
        },
      }
      deploymentAction = {
        ...deploymentAction,
        ...rollbackExecution,
      }
    }


    return [deploymentAction]
  }


  return {
    createDockerDeploymentAction,
  }
}
