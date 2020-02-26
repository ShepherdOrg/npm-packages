import { expect } from "chai"
import { mapUntypedDeploymentData } from "./map-untyped-deployment-data"
import { deploymentData0, deploymentData1 } from "./testdata/shepherd-deployment-data"
import { expectedK8sDeployment0, expectedK8sDeployment1 } from "../testdata/deployment-json/expected"
import { TDeploymentType, THerdDeployerMetadata, THerdK8sMetadata } from "@shepherdorg/metadata/dist"
import { IDockerImageKubectlDeploymentAction } from "../deployment-types"


function expectMappedToMatchExpectedData(deploymentInfo: IDockerImageKubectlDeploymentAction, expectedData:THerdK8sMetadata | THerdDeployerMetadata, deploymentType: TDeploymentType) {
  let mappedData = mapUntypedDeploymentData(deploymentInfo)

  expect(deploymentType).to.equal(mappedData?.deploymentType)
  expect(expectedData).to.deep.equal(mappedData)
}

describe("raw deployment data mapping", function() {

  it("should map from deployment data 0", () => {
    expectMappedToMatchExpectedData(deploymentData0() as IDockerImageKubectlDeploymentAction, expectedK8sDeployment0(), TDeploymentType.Kubernetes)
  })

  it("should map from deployment data 1", () => {
    expectMappedToMatchExpectedData(deploymentData1() as IDockerImageKubectlDeploymentAction, expectedK8sDeployment1(), TDeploymentType.Kubernetes)
  })

  it("should complain if herdSpec.key is undefined", () => {
    try{
      let deploymentInfo = deploymentData0()

      delete deploymentInfo.herdKey
      mapUntypedDeploymentData(deploymentInfo as IDockerImageKubectlDeploymentAction)

    }catch(err){
      expect(err.message).to.contain('Missing herdSpec key. In deployment info object: ')
    }
  })
})
