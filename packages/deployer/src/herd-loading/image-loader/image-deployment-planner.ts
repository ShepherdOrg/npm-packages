import { IExecutableAction, ILog, THerdSectionDeclaration, TImageInformation } from "../../deployment-types"
import { createKubectlDeploymentActions } from "../../deployment-actions/kubectl-deployer/create-image-based-kubectl-deployment-action"
import { createDockerDeploymentActions } from "../../deployment-actions/docker-deployer/docker-deployment-action"
import { TExtensionsMap } from "../../deployment-actions/kubectl-deployer/kube-supported-extensions"
import { emptyArray } from "../../helpers/ts-functions"
import { ICreateDeploymentTestAction } from "./deployment-test-action"
import { newProgrammerOops, Oops } from "oops-error"

export type TImageDeploymentPlannerDependencies = {
  deploymentTestActionFactory: ICreateDeploymentTestAction
  logger: ILog
  kubeSupportedExtensions: TExtensionsMap
  herdSectionDeclaration: THerdSectionDeclaration
}

export interface IPlanImageDeploymentActions {
  createDeploymentActions(imageInformation: TImageInformation): Promise<Array<IExecutableAction>>
}

export function createImageDeploymentPlanner(injected: TImageDeploymentPlannerDependencies): IPlanImageDeploymentActions {
  const kubeSupportedExtensions = injected.kubeSupportedExtensions
  const logger = injected.logger
  const deploymentTestActionFactory = injected.deploymentTestActionFactory

  async function createDeploymentActions(imageInformation: TImageInformation): Promise<Array<IExecutableAction>> {
    if (imageInformation.shepherdMetadata) {

      let resultingActions: Array<IExecutableAction> = emptyArray<IExecutableAction>()

      if(!imageInformation.imageDeclaration){
        throw newProgrammerOops('Invalid image information, no image declaration!', imageInformation)
      }
      imageInformation.imageDeclaration.sectionDeclaration = injected.herdSectionDeclaration
      if (imageInformation.shepherdMetadata.preDeployTest) {
        resultingActions.push(deploymentTestActionFactory.createDeploymentTestAction(imageInformation.shepherdMetadata.preDeployTest, imageInformation.shepherdMetadata))
      }
      if (imageInformation.shepherdMetadata.deploymentType === "deployer") {
        resultingActions = resultingActions.concat(await createDockerDeploymentActions(imageInformation))
      } else if (imageInformation.shepherdMetadata.deploymentType === "k8s") {
        resultingActions = resultingActions.concat(await createKubectlDeploymentActions(imageInformation, kubeSupportedExtensions, logger))
      } else {
        throw new Error(`Unexpected: No planner in place for deploymentType ${imageInformation.shepherdMetadata.deploymentType} in ${imageInformation.shepherdMetadata.displayName} `)
      }

       // TODO Move rollout wait action creation here

      if (imageInformation.shepherdMetadata.postDeployTest) {
        resultingActions.push(deploymentTestActionFactory.createDeploymentTestAction(imageInformation.shepherdMetadata.postDeployTest, imageInformation.shepherdMetadata))
      }


      return resultingActions
    } else {
      throw new Error("No shepherd metadata present! Do not know what to do with " + JSON.stringify(imageInformation))
    }
  }

  return { createDeploymentActions: createDeploymentActions }
}
