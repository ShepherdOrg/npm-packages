import { TDeploymentState, TImageMetadata, TTestSpecification } from "@shepherdorg/metadata"
import { IExecutableAction, ILog, IRollbackActionExecution, TActionExecutionOptions } from "../../deployment-types"
import { createDockerExecutionAction } from "../../deployment-actions/docker-deployer/docker-deployment-action"

export interface ICreateDeploymentTestAction {
  createDeploymentTestAction(
    deployTestDeclaration: TTestSpecification,
    shepherdMetadata: TImageMetadata,
    rollbackAction?: IRollbackActionExecution
  ): IExecutableAction
}

export function createDeploymentTestActionFactory() {
  function createDeploymentTestAction(
    deployTestDeclaration: TTestSpecification,
    shepherdMetadata: TImageMetadata,
    rollbackAction?: IRollbackActionExecution
  ): IExecutableAction {
    let dockerExecutionAction = createDockerExecutionAction(
      shepherdMetadata,
      deployTestDeclaration.dockerImageUrl || shepherdMetadata.dockerImageUrl as string,
      shepherdMetadata.displayName,
      "testHerdKey",
      deployTestDeclaration.command,
      deployTestDeclaration.environment || []
    )

    const rollbackEnablingExecution = {
      execute: async function(deploymentOptions: TActionExecutionOptions, cmd: any, logger: ILog, saveDeploymentState: (stateSignatureObject: any)=> Promise<TDeploymentState>): Promise<IExecutableAction>{
        return dockerExecutionAction.execute(deploymentOptions, cmd, logger, saveDeploymentState ).catch((testError)=>{
          if(rollbackAction){
            logger.warn('Test failed, rolling back to last good version!')
            rollbackAction.rollback()
          }
          throw testError
        })
      }
    }
    return {
      ...dockerExecutionAction,
      ...rollbackEnablingExecution
    }
  }

  return {
    createDeploymentTestAction
  }
}
