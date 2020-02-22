import { TImageMetadata, TTestSpecification } from "@shepherdorg/metadata"
import {
  IExecutableAction,
  ILog,
  IRollbackActionExecution,
  TActionExecutionOptions,
} from "../../deployment-types"
import { ICreateDockerActions } from "../../deployment-actions/docker-action/docker-action"

export interface ICreateDeploymentTestAction {
  createDeploymentTestAction(
    deployTestDeclaration: TTestSpecification,
    shepherdMetadata: TImageMetadata,
    rollbackAction?: IRollbackActionExecution
  ): IExecutableAction
}

export type TDeploymentTestActionFactoryDependencies = { dockerActionFactory:ICreateDockerActions, logger: ILog }

export function createDeploymentTestActionFactory({dockerActionFactory, logger}:TDeploymentTestActionFactoryDependencies) {
  function createDeploymentTestAction(
    deployTestDeclaration: TTestSpecification,
    shepherdMetadata: TImageMetadata,
    rollbackAction?: IRollbackActionExecution
  ): IExecutableAction {
    let dockerExecutionAction = dockerActionFactory.createDockerExecutionAction(
      shepherdMetadata,
      deployTestDeclaration.dockerImageUrl || (shepherdMetadata.dockerImageUrl as string),
      shepherdMetadata.displayName,
      "testHerdKey",
      deployTestDeclaration.command,
      deployTestDeclaration.environment || []
    )

    const rollbackEnablingExecution = {
      execute: async function(
        deploymentOptions: TActionExecutionOptions
      ): Promise<IExecutableAction> {
        return dockerExecutionAction.execute(deploymentOptions).catch(testError => {
          if (rollbackAction) {
            logger.warn("Test failed, rolling back to last good version!")
            rollbackAction.rollback()
          }
          throw testError
        })
      },
    }
    return {
      ...dockerExecutionAction,
      ...rollbackEnablingExecution,
    }
  }

  return {
    createDeploymentTestAction,
  }
}
