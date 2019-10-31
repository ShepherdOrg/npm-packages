import { createClient } from "@shepherdorg/ui-graphql-client"
import { THerdDeployerMetadata } from "./temptypes"
import { mapToUiVersion } from "./mapDeploymentInfoToUI"

export function CreatePushApi(endPoint: string, logger: typeof console) {
  const shepherdUiClient = createClient(endPoint)

  async function pushDeploymentStateToUI(deploymentState: THerdDeployerMetadata) {
    let uiVersion = mapToUiVersion(deploymentState)
    if(uiVersion){
      await shepherdUiClient.upsertDeployment([uiVersion.deploymentInfo])
      await shepherdUiClient.upsertDeploymentVersion([uiVersion.versionInfo])
    } else {
      logger.info(`${deploymentState.displayName} from ${deploymentState.gitUrl} deployment info not pushed. Modified: ${deploymentState.deploymentState.modified}, timestamp: ${deploymentState.deploymentState.timestamp}`)
    }
  }

  return {
    pushDeploymentStateToUI,
  }
}
