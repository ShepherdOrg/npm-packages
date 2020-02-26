import {
  IExecutableAction,
  ILog,
  THerdSectionDeclaration,
  TImageInformation, TRollbackResult,
} from "../deployment-types"
import { createKubectlDeploymentActionsFactory } from "../deployment-actions/kubectl-action/create-docker-kubectl-deployment-actions"
import { TExtensionsMap } from "../deployment-actions/kubectl-action/kube-supported-extensions"
import { emptyArray } from "../helpers/ts-functions"
import { ICreateDeploymentTestAction, IRollbackDeployment } from "../herd-loading/image-loader/deployment-test-action"
import { newProgrammerOops } from "oops-error"
import { IDeploymentPlan, IDeploymentPlanFactory } from "./deployment-plan-factory"
import { createDockerDeployerActionFactory } from "../deployment-actions/docker-action/create-docker-deployment-action"
import { ICreateDockerActions } from "../deployment-actions/docker-action/docker-action"
import {
  ICreateKubectlDeploymentAction,
} from "../deployment-actions/kubectl-action/kubectl-deployment-action-factory"

export type TImageDeploymentPlannerDependencies = {
  planFactory: IDeploymentPlanFactory
  logger: ILog
  kubectlActionFactory: ICreateKubectlDeploymentAction
  dockerActionFactory: ICreateDockerActions
  deploymentTestActionFactory: ICreateDeploymentTestAction
  kubeSupportedExtensions: TExtensionsMap
}

export interface ICreateImageDeploymentPlan {
  createDeploymentActions(imageInformation: TImageInformation, herdSectionDeclaration: THerdSectionDeclaration): Promise<Array<IExecutableAction>>
  createImageDeploymentPlan(imageInformation: TImageInformation): Promise<IDeploymentPlan>
}

export function createImageDeploymentPlanner(injected: TImageDeploymentPlannerDependencies): ICreateImageDeploymentPlan {
  const kubeSupportedExtensions = injected.kubeSupportedExtensions
  const deploymentTestActionFactory = injected.deploymentTestActionFactory

  let kubectlDeploymentActionFactory = injected.kubectlActionFactory
  let deployerActionFactory = createDockerDeployerActionFactory({ executionActionFactory: injected.dockerActionFactory, logger: injected.logger })
  let tKubectlDeploymentActionFactory = createKubectlDeploymentActionsFactory({ deploymentActionFactory: kubectlDeploymentActionFactory, logger: injected.logger })

  async function createDeploymentActions(imageInformation: TImageInformation): Promise<Array<IExecutableAction>> {
    if (imageInformation.shepherdMetadata) {
      let resultingActions: Array<IExecutableAction> = emptyArray<IExecutableAction>()

      if (!imageInformation.imageDeclaration) {
        throw newProgrammerOops("Invalid image information, no image declaration!", imageInformation)
      }
      if (imageInformation.shepherdMetadata.preDeployTest) {
        resultingActions.push(deploymentTestActionFactory.createDeploymentTestAction(imageInformation.shepherdMetadata.preDeployTest, imageInformation.shepherdMetadata))
      }
      let deploymentActions: Array<IExecutableAction>
      if (imageInformation.shepherdMetadata.deploymentType === "deployer") {
        deploymentActions = await deployerActionFactory.createDockerDeploymentAction(imageInformation)
      } else if (imageInformation.shepherdMetadata.deploymentType === "k8s") {
        deploymentActions = await tKubectlDeploymentActionFactory.createKubectlDeploymentActions(imageInformation, kubeSupportedExtensions)
        // TODO MUST TODO Move rollout wait action creation here to have in the correct execution order for the plan
      } else {
        throw new Error(`Unexpected: No planner in place for deploymentType ${imageInformation.shepherdMetadata.deploymentType} in ${imageInformation.shepherdMetadata.displayName} `)
      }
      resultingActions = resultingActions.concat(deploymentActions)


      if (imageInformation.shepherdMetadata.postDeployTest) {
        let deploymentActionsRollback : IRollbackDeployment = {
          async rollbackDeploymentPlan(): Promise<TRollbackResult> {
            let NO_ROLLBACK_RESULT = {code:0}
            return  await Promise.all(deploymentActions.map(rollback => rollback.canRollbackExecution() && rollback.rollback() || NO_ROLLBACK_RESULT)).then(()=>{return {}})
          }
        }
        resultingActions.push(deploymentTestActionFactory.createDeploymentTestAction(imageInformation.shepherdMetadata.postDeployTest, imageInformation.shepherdMetadata, deploymentActionsRollback))
      }

      return resultingActions
    } else {
      throw new Error("No shepherd metadata present! Do not know what to do with " + JSON.stringify(imageInformation))
    }

  }

  async function createImageDeploymentPlan(imageInformation: TImageInformation): Promise<IDeploymentPlan> {
    if (imageInformation.shepherdMetadata) {

      const resultingActions = await createDeploymentActions(imageInformation)
      const resultingPlan = injected.planFactory.createDeploymentPlan(imageInformation.imageDeclaration)
      await Promise.all(resultingActions.map(resultingPlan.addAction))

      return resultingPlan
    } else {
      throw new Error("No shepherd metadata present! Do not know what to do with " + JSON.stringify(imageInformation))
    }
  }

  return {
    createDeploymentActions: createDeploymentActions,
    createImageDeploymentPlan: createImageDeploymentPlan,
  }
}
