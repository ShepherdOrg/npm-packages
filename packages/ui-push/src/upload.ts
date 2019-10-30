import { createClient } from "@shepherdorg/ui-graphql-client"
import { THerdDeployerMetadata } from "./temptypes"
import { mapToUiVersion } from "./mapDeploymentInfoToUI"

export function CreatePushApi(endPoint: string) {
  const shepherdUiClient = createClient(endPoint)

  async function pushDeploymentStateToUI(deploymentState: THerdDeployerMetadata) {
    const { deploymentInfo, versionInfo } = mapToUiVersion(deploymentState)

    await shepherdUiClient.upsertDeployment([deploymentInfo])
    await shepherdUiClient.upsertDeploymentVersion([versionInfo])
  }

  return {
    pushDeploymentStateToUI,
  }
}
