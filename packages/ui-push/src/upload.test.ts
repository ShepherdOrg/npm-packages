import { CreatePushApi } from "./upload"
import { getValidHerdDeployerMetadata } from "./testdata/testdata"

function main(){

  CreatePushApi('http://localhost:8080/v1/graphql', console).pushDeploymentStateToUI(getValidHerdDeployerMetadata())

}


main()
