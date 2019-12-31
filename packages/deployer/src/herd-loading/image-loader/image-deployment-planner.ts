import {
  ILog,
  IAnyDeploymentAction, THerdSectionDeclaration, TImageInformation,
} from "../../deployment-types"
import { calculateKubectlActions } from "../../deployment-actions/kubectl-deployer/create-image-based-kubectl-deployment-action"
import { calculateDeployerAction } from "../../deployment-actions/docker-deployer/docker-deployment-action"
import { TExtensionsMap } from "../../deployment-actions/kubectl-deployer/kube-supported-extensions"

export type TImageDeploymentPlannerDependencies={
  logger: ILog
  kubeSupportedExtensions: TExtensionsMap
  herdSectionDeclaration: THerdSectionDeclaration
}

export function createImageDeploymentPlanner(injected:TImageDeploymentPlannerDependencies) {
  const kubeSupportedExtensions = injected.kubeSupportedExtensions
  const logger = injected.logger

  async function calculateDeploymentActions(imageInformation:TImageInformation): Promise<Array<IAnyDeploymentAction >>  {
    if (imageInformation.shepherdMetadata) {

      if (imageInformation.shepherdMetadata.deploymentType === "deployer") {
        return calculateDeployerAction(imageInformation)
      } else if (imageInformation.shepherdMetadata.deploymentType === "k8s") {
        return calculateKubectlActions(imageInformation, kubeSupportedExtensions, logger)
      } else {
        throw new Error(`Unexpected: No planner in place for deploymentType ${imageInformation.shepherdMetadata.deploymentType} in ${imageInformation.shepherdMetadata.displayName} `)
      }
    } else {
      // return Promise.resolve([])
      // Todo looks like a probable bug around infrastructure. Resolve this!
      throw new Error('No shepherd metadata present! Do not know what to do with ' + JSON.stringify(imageInformation))
    }
  }

  return { calculateDeploymentActions: calculateDeploymentActions }
}
