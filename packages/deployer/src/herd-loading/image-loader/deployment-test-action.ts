import { TImageMetadata, TTestSpecification } from "@shepherdorg/metadata"
import {
  canRollbackExecution,
  IExecutableAction,
  ILog,
  TActionExecutionOptions, TRollbackResult,
} from "../../deployment-types"
import { ICreateDockerActions } from "../../deployment-actions/docker-action/docker-action"
import { isOops } from "../../helpers/isOops"

export interface ICreateDeploymentTestAction {
  createDeploymentTestAction(
    deployTestDeclaration: TTestSpecification,
    shepherdMetadata: TImageMetadata,
    onFailureCallMe?: IRollbackDeployment
  ): IExecutableAction
}

export type TDeploymentTestActionFactoryDependencies = { dockerActionFactory:ICreateDockerActions, logger: ILog }

export interface IRollbackDeployment {
  rollbackDeploymentPlan(): Promise<TRollbackResult>
}

export function createDeploymentTestActionFactory({dockerActionFactory, logger}:TDeploymentTestActionFactoryDependencies) {
  function createDeploymentTestAction(
    deployTestDeclaration: TTestSpecification,
    shepherdMetadata: TImageMetadata,
    onTestFailureCallMe?: IRollbackDeployment
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
        return dockerExecutionAction.execute(deploymentOptions).catch(async testError => {
          if(onTestFailureCallMe){
            await onTestFailureCallMe.rollbackDeploymentPlan()
          }
          if(isOops(testError)){
            logger.error('Test output: vvvvvvvvvvvvvvvv')
            // @ts-ignore
            logger.error(testError.context.stdOut)
            logger.error('^^^^^^^^^^^^^^^^^^^^^^^')
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
