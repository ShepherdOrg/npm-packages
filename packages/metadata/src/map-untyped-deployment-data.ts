import { THerdK8sMetadata } from "./index"

export function mapUntypedDeploymentData(deploymentInfo) {

  if (!deploymentInfo.state) {
    throw new Error("Expecting state property on deploymentInfo object" + Object.keys(deploymentInfo).join(", "))
  }

  const mappedDeploymentInfo = {
    ...deploymentInfo.metadata,
    deploymentState: deploymentInfo.state,
    herdSpec: deploymentInfo.herdSpec,
  }

  mappedDeploymentInfo.herdSpec.key = deploymentInfo.herdKey

  mappedDeploymentInfo.deploymentState.timestamp =
    mappedDeploymentInfo.deploymentState.timestamp && new Date(mappedDeploymentInfo.deploymentState.timestamp)
  mappedDeploymentInfo.buildDate = mappedDeploymentInfo.buildDate && new Date(mappedDeploymentInfo.buildDate)

  const typedInfo = mappedDeploymentInfo as THerdK8sMetadata

  if (typedInfo.kubeDeploymentFiles) { // Remove folders from structure
    for (let fileName in typedInfo.kubeDeploymentFiles) {
      let tfile = typedInfo.kubeDeploymentFiles[fileName]
      if (!Boolean(tfile.content)) {
        delete typedInfo.kubeDeploymentFiles[fileName]
      }
    }
  }



  delete mappedDeploymentInfo.dockerImageGithash
  delete mappedDeploymentInfo.kubeConfigB64
  delete mappedDeploymentInfo.herdSpec.herdKey


  return mappedDeploymentInfo
}
