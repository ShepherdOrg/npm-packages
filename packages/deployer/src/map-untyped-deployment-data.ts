import {
  THerdDeployerMetadata,
  THerdK8sMetadata,
  THerdMetadata,
  THerdSpec,
  TImageMetadata,
} from "@shepherdorg/metadata"
import { TFullDeploymentAction, TTempHerdSpec } from "./deployment-manager/deployment-types"


export function mapUntypedDeploymentData(deploymentInfo: TFullDeploymentAction): THerdK8sMetadata | THerdDeployerMetadata {

  if (!deploymentInfo.state) {
    throw new Error("Expecting state property on deploymentInfo object -> " + Object.keys(deploymentInfo).join(", "))
  }

  function mapHerdSpec(herdSpec: TTempHerdSpec):THerdSpec {
    let key = herdSpec.herdKey
    let mappedHerdSpec = { key: key, ...herdSpec}
    delete mappedHerdSpec.herdKey
    return mappedHerdSpec
  }

  const mappedDeploymentInfo: THerdMetadata & TImageMetadata = {
    ...deploymentInfo.metadata,
    deploymentState: deploymentInfo.state,
    herdSpec: mapHerdSpec(deploymentInfo.herdSpec),
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
