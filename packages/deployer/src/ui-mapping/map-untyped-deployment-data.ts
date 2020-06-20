import { THerdK8sMetadata, THerdSpec } from "@shepherdorg/metadata"
import { IAnyDeploymentAction } from "../deployment-types"


export function mapUntypedDeploymentData(deploymentInfo: IAnyDeploymentAction | undefined): any { // TODO Type on output data here, depends on exported types from UI API

  if(!deploymentInfo){
    return undefined
  }

  if(!deploymentInfo.herdDeclaration){
    return undefined
  }

  if (!deploymentInfo.getActionDeploymentState) {
    throw new Error("Expecting state getter on deploymentInfo object -> " + Object.keys(deploymentInfo).join(", "))
  }

  function mapHerdSpec(herdSpec: THerdSpec):THerdSpec {
    let unknownSpec = herdSpec as unknown as any
    let key = unknownSpec.herdKey || unknownSpec.key
    let mappedHerdSpec = { ...herdSpec, key: key}
    // @ts-ignore
    delete mappedHerdSpec.herdKey
    // @ts-ignore
    delete mappedHerdSpec.sectionDeclaration // TODO We probably want the section name in the UI for display and reporting purposes.
    return mappedHerdSpec
  }

  const mappedDeploymentInfo:  any = {
    ...deploymentInfo.metadata,
    deploymentState: deploymentInfo.getActionDeploymentState(),
    herdSpec: mapHerdSpec(deploymentInfo.herdDeclaration as THerdSpec),
  }

  if(!mappedDeploymentInfo.herdSpec.key){
    throw new Error('Missing herdSpec key. In mapped deployment info object: ' + JSON.stringify(mappedDeploymentInfo, null, 2))
  }

  mappedDeploymentInfo.deploymentState.timestamp =
    mappedDeploymentInfo.deploymentState.timestamp && new Date(mappedDeploymentInfo.deploymentState.timestamp)
  if(!deploymentInfo.metadata.buildDate){
    console.warn('WARNING: Using temporary hack to set buildDate at mapping/deployment time! HerdKey:' + mappedDeploymentInfo.herdSpec.key)
    deploymentInfo.metadata.buildDate = new Date().toISOString() // TODO Remove once filesystem buildtime is in place, this provides backwards compatibility for UI upload until then.
  }
  mappedDeploymentInfo.buildDate = new Date(deploymentInfo.metadata.buildDate)

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
