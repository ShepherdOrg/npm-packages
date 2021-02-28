import { TImageMetadata, TTestSpecification } from "@shepherdorg/metadata"
import { IStatefulExecutableAction, TActionExecutionOptions, TRollbackResult } from "../../deployment-types"
import { ICreateDockerActions } from "../docker-action/docker-action"
import { isOops } from "../../helpers/isOops"
import { ILog, TLogContext } from "../../logging/logger"

export interface ICreateDeploymentTestAction {
  createDeploymentTestAction(
    deployTestDeclaration: TTestSpecification,
    shepherdMetadata: TImageMetadata,
    onFailureCallMe?: IRollbackAction
  ): IStatefulExecutableAction
}

export type TDeploymentTestActionFactoryDependencies = { dockerActionFactory: ICreateDockerActions; logger: ILog }

export interface IRollbackAction {
  rollback(actionExecutionOptions: TActionExecutionOptions): Promise<TRollbackResult>
}

export function createDeploymentTestActionFactory({
  dockerActionFactory,
  logger,
}: TDeploymentTestActionFactoryDependencies) {
  function createDeploymentTestAction(
    deployTestDeclaration: TTestSpecification,
    shepherdMetadata: TImageMetadata,
    onTestFailureCallMe?: IRollbackAction
  ): IStatefulExecutableAction {
    let dockerExecutionAction = dockerActionFactory.createDockerExecutionAction(
      shepherdMetadata,
      deployTestDeclaration.dockerImageUrl || (shepherdMetadata.dockerImageUrl as string),
      shepherdMetadata.displayName,
      "testHerdKey",
      deployTestDeclaration.command,
      deployTestDeclaration.environment || []
    )

    const rollbackEnablingExecution = {
      isStateful: false,
      execute: async function(executionOptions: TActionExecutionOptions): Promise<IStatefulExecutableAction> {
        return dockerExecutionAction.execute(executionOptions).catch(async testRunException => {
          if (onTestFailureCallMe) {
            logger.info("Test run failed, rolling back to last good version.", executionOptions.logContext)
            await onTestFailureCallMe.rollback(executionOptions)
          }
          if (isOops(testRunException)) {
            logger.error("vvvvvvvvvvvvvvvv test output vvvvvvvvvvvvvvvv", undefined, executionOptions.logContext)
            logger.error(testRunException.message, testRunException, executionOptions.logContext)
            // @ts-ignore
            logger.error(testRunException.context.stdOut, undefined, executionOptions.logContext)
            logger.error("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^", undefined, executionOptions.logContext)
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
