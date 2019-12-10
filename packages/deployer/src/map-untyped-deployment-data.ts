import {
  THerdDeployerMetadata,
  THerdK8sMetadata,
  THerdMetadata,
  THerdSpec,
  TImageMetadata,
} from "@shepherdorg/metadata"
import {
  TImageDeploymentAction, TK8sDockerImageDeploymentAction,
} from "./deployment-manager/deployment-types"


export function mapUntypedDeploymentData(deploymentInfo: TImageDeploymentAction | TK8sDockerImageDeploymentAction | undefined): THerdK8sMetadata | THerdDeployerMetadata | undefined {

  if(!deploymentInfo){
    return undefined
  }

  if (!deploymentInfo.state) {
    throw new Error("Expecting state property on deploymentInfo object -> " + Object.keys(deploymentInfo).join(", "))
  }

  function mapHerdSpec(herdSpec: THerdSpec):THerdSpec {
    let unknownSpec = herdSpec as unknown as any
    let key = unknownSpec.herdKey || unknownSpec.key
    let mappedHerdSpec = { key: key, ...herdSpec}
    // @ts-ignore
    delete mappedHerdSpec.herdKey
    return mappedHerdSpec
  }

  const mappedDeploymentInfo: THerdMetadata & TImageMetadata = {
    ...deploymentInfo.metadata,
    deploymentState: deploymentInfo.state,
    herdSpec: mapHerdSpec(deploymentInfo.herdSpec as THerdSpec),
  }

  if(!mappedDeploymentInfo.herdSpec.key){
    throw new Error('Missing herdSpec key. In mapped deployment info object: ' + JSON.stringify(mappedDeploymentInfo, null, 2))
  }

  mappedDeploymentInfo.deploymentState.timestamp =
    mappedDeploymentInfo.deploymentState.timestamp && new Date(mappedDeploymentInfo.deploymentState.timestamp)
  mappedDeploymentInfo.buildDate = deploymentInfo.metadata.buildDate && new Date(deploymentInfo.metadata.buildDate)

  const typedInfo = mappedDeploymentInfo as THerdK8sMetadata

  if (typedInfo.kubeDeploymentFiles) { // Remove folders from structure
    for (let fileName in typedInfo.kubeDeploymentFiles) {
      let tfile = typedInfo.kubeDeploymentFiles[fileName]
      if (!Boolean(tfile.content)) {
        delete typedInfo.kubeDeploymentFiles[fileName]
      }
    }
  }

  // @ts-ignore
  delete mappedDeploymentInfo.dockerImageGithash
  // @ts-ignore
  delete mappedDeploymentInfo.kubeConfigB64

  return mappedDeploymentInfo
}
