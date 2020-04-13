import { TImageMetadata, TTestSpecification } from "@shepherdorg/metadata"
import {
  IExecutableAction, TActionExecutionOptions, TRollbackResult,
} from "../../deployment-types"
import { ICreateDockerActions } from "../docker-action/docker-action"
import { isOops } from "../../helpers/isOops"
import { ILog } from "../../logging/logger"

export interface ICreateDeploymentTestAction {
  createDeploymentTestAction(
    deployTestDeclaration: TTestSpecification,
    shepherdMetadata: TImageMetadata,
    onFailureCallMe?: IRollbackAction
  ): IExecutableAction
}

export type TDeploymentTestActionFactoryDependencies = { dockerActionFactory:ICreateDockerActions, logger: ILog }

export interface IRollbackAction {
  rollback(): Promise<TRollbackResult>
}

export function createDeploymentTestActionFactory({dockerActionFactory, logger}:TDeploymentTestActionFactoryDependencies) {
  function createDeploymentTestAction(
    deployTestDeclaration: TTestSpecification,
    shepherdMetadata: TImageMetadata,
    onTestFailureCallMe?: IRollbackAction
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
      isStateful:false,
      execute: async function(
        deploymentOptions: TActionExecutionOptions
      ): Promise<IExecutableAction> {
        return dockerExecutionAction.execute(deploymentOptions).catch(async testRunException => {
          if(onTestFailureCallMe){
            logger.info('Test run failed, rolling back to last good version.')
            await onTestFailureCallMe.rollback()
          }
          if(isOops(testRunException)){
            logger.error('vvvvvvvvvvvvvvvv test output vvvvvvvvvvvvvvvv')
            logger.error(testRunException.message)
            // @ts-ignore
            logger.error(testRunException.context.stdOut)
            logger.error('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^')
          }
          throw testRunException
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
