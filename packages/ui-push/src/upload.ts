import { createClient } from "@shepherdorg/ui-graphql-client"
import { THerdDeployerMetadata } from "./temptypes"
import { mapToUiVersion } from "./mapDeploymentInfoToUI"

interface DeploymentStatePushResults {
  deploymentResult: any,
  deploymentVersionResult: any,
}

export function CreatePushApi(endPoint: string, logger: typeof console) {
  const shepherdUiClient = createClient(endPoint)

  async function pushDeploymentStateToUI(deploymentState: THerdDeployerMetadata) {
    let uiVersion = mapToUiVersion(deploymentState)
    if(uiVersion){
      logger.debug('Pushing deployment info to UI ', JSON.stringify(uiVersion.deploymentInfo))
      const pushResults:DeploymentStatePushResults = {
        deploymentResult: undefined,
        deploymentVersionResult: undefined
      }
      pushResults.deploymentResult = await shepherdUiClient.upsertDeployment([uiVersion.deploymentInfo])
      pushResults.deploymentVersionResult = await shepherdUiClient.upsertDeploymentVersion([uiVersion.versionInfo])

      logger.debug(`${deploymentState.displayName} from ${deploymentState.gitUrl} deployment info pushed to UI @ ${endPoint}`)
      return pushResults
    } else {
      logger.debug(`${deploymentState.displayName} from ${deploymentState.gitUrl} deployment info not pushed. Modified: ${deploymentState.deploymentState.modified}, timestamp: ${deploymentState.deploymentState.timestamp}`)
      return undefined
    }
  }

  return {
    pushDeploymentStateToUI,
  }
}
