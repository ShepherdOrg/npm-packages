import { THerdDeployerMetadata } from "./temptypes"

export function mapUntypedDeploymentData (deploymentInfo:any):THerdDeployerMetadata {
  const mappedDeploymentInfo = {
    ...deploymentInfo.metadata,
    deploymentState: deploymentInfo.state,
    herdSpec: deploymentInfo.herdSpec,
  }
  mappedDeploymentInfo.herdSpec.key = deploymentInfo.herdName

  mappedDeploymentInfo.deploymentState.timestamp = new Date(mappedDeploymentInfo.deploymentState.timestamp)
  mappedDeploymentInfo.buildDate = new Date(mappedDeploymentInfo.buildDate)

  return mappedDeploymentInfo
}
