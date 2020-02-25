import {
  IDockerDeploymentAction, ILog,
  IRollbackActionExecution,
  TImageInformation,
  TRollbackResult,
} from "../../deployment-types"
import { TDeployerMetadata } from "@shepherdorg/metadata"
import { ICreateDockerActions } from "./docker-action"

export type TDockerDeploymentActionFactoryDependencies = {
  executionActionFactory: ICreateDockerActions,
  logger: ILog
}

export function createDockerDeployerActionFactory({ executionActionFactory,logger }: TDockerDeploymentActionFactoryDependencies) {

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

      const rollbackExecution: IRollbackActionExecution = {
        rollback(): TRollbackResult {
          // TODO Push old state to UI

          const rollbackAction = executionActionFactory.createDockerExecutionAction(
            deployerMetadata,
            imageInformation.imageDeclaration.dockerImage ||
            imageInformation.imageDeclaration.image + ":" + imageInformation.imageDeclaration.imagetag,
            `${imageInformation.shepherdMetadata?.displayName || ""} rollback`,
            imageInformation.imageDeclaration.key,
            deployerMetadata.rollbackCommand as string, // Null check performed outside of checker scope
            deployerMetadata.environment,
            deployerMetadata.environmentVariablesExpansionString,
          )


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
