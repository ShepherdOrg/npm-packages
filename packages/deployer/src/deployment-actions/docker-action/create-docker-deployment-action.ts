import {
  IDockerDeploymentAction,
  ICanRollbackActionExecution,
  TImageInformation,
  TRollbackResult,
} from "../../deployment-types"
import { TDeployerMetadata } from "@shepherdorg/metadata"
import { ICreateDockerActions } from "./docker-action"
import { ILog, TLogContext } from "../../logging/logger"

export type TDockerDeploymentActionFactoryDependencies = {
  environment: string
  executionActionFactory: ICreateDockerActions
  logger: ILog
}

export type ICreateDockerDeploymentActions = {
  createDockerDeploymentAction: (imageInformation: TImageInformation, logContext: TLogContext) => Promise<Array<IDockerDeploymentAction>>
}

export function createDockerDeployerActionFactory(
  injected: TDockerDeploymentActionFactoryDependencies
): ICreateDockerDeploymentActions {
  async function createDockerDeploymentAction(
    imageInformation: TImageInformation,
    logContext: TLogContext
  ): Promise<Array<IDockerDeploymentAction>> {
    let deployerMetadata = imageInformation.shepherdMetadata as TDeployerMetadata

    const executionAction = injected.executionActionFactory.createDockerExecutionAction(
      deployerMetadata,
      imageInformation.imageDeclaration.dockerImage ||
        imageInformation.imageDeclaration.image + ":" + imageInformation.imageDeclaration.imagetag,
      imageInformation.shepherdMetadata?.displayName || "",
      imageInformation.imageDeclaration.key,
      deployerMetadata.deployCommand || "deploy",
      deployerMetadata.environment,
      deployerMetadata.environmentVariablesExpansionString
    )

    let deploymentAction = {
      ...{
        herdKey: imageInformation.imageDeclaration.key,
        type: "deployer",
        herdDeclaration: imageInformation.imageDeclaration,
        metadata: deployerMetadata,
        displayName: imageInformation.shepherdMetadata?.displayName || "",
        env: injected.environment,
        version: imageInformation.imageDeclaration.imagetag,
      },
      ...executionAction,
    }

    if (deployerMetadata.rollbackCommand) {
      const rollbackExecution: ICanRollbackActionExecution = {
        async rollback(): Promise<TRollbackResult> {
          // TODOLATER Push old state to UI

          const rollbackAction = injected.executionActionFactory.createDockerExecutionAction(
            deployerMetadata,
            imageInformation.imageDeclaration.dockerImage ||
              imageInformation.imageDeclaration.image + ":" + imageInformation.imageDeclaration.imagetag,
            `${imageInformation.shepherdMetadata?.displayName || ""} rollback`,
            imageInformation.imageDeclaration.key,
            deployerMetadata.rollbackCommand as string, // Null check performed outside of checker scope
            deployerMetadata.environment,
            deployerMetadata.environmentVariablesExpansionString
          )

          injected.logger.info(`Executing docker action rollback ${rollbackAction.planString()}`, logContext)
          return await rollbackAction
            .execute({
              pushToUi: false,
              dryRun: false,
              waitForRollout: false,
              dryRunOutputDir: "",
              logContext,
            })
            .then(() => {
              injected.logger.info(`Rollback complete. Original error follows.`, logContext)
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
