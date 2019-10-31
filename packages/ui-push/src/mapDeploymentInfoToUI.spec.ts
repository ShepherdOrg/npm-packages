import { expect } from "chai"
import { getValidHerdDeployerMetadata } from "./testdata"
import { mapToUiVersion } from "./mapDeploymentInfoToUI"
import { Deployment, DeploymentVersion } from "@shepherdorg/ui-graphql-client"


describe("mapping", function() {
  it("should map deployer info to UI", () => {
    const input = getValidHerdDeployerMetadata()

    const expectedVersionInfo: DeploymentVersion = {
      build_host_name: "Gulaugurs-MacBook-Pro.local",
      built_at: "2019-10-21T14:53:18.000Z",
      deployed_at: "2019-10-21T14:53:18.000Z",
      deployment_id: "devdev-images-plain-deployer",
      docker_image: "plain-deployer-repo:latest",
      docker_image_tag: "plain-deployer-repo:latest",
      env: "dev",
      git_branch: "dev",
      git_commit: "2153e378877c0deaa2a3ee2491800d40f5212bc5",
      git_hash: "062b591",
      git_url: "git@github.com:ShepherdOrg/npm-packages.git",
      kubernetes_deployment_files: [],
      last_commits:
        " Sun, 20 Oct 2019 17:55:38 +0000 by Guðlaugur S. Egilsson. --- Metadata updates and a few more fixes. \n\n Wed, 9 Oct 2019 13:52:56 +0000 by Guðlaugur S. Egilsson. --- First pass on shepherd-inspect, not ready at all though. \n\n Mon, 7 Oct 2019 14:28:50 +0000 by Guðlaugur S. Egilsson. --- Adding json schema for validating shepherd.json config file \n\n Fri, 4 Oct 2019 15:00:24 +0000 by Guðlaugur S. Egilsson. --- Introducing npm installable build docker script. Changing docker label for metadata packaging \n",
      version: "latest",
      id: "devdev-images-plain-deployer999.999.999992019-10-21T14:53:18.000Z",
    }

    let expectedDeploymentInfo: Deployment = {
      id: "devdev-images-plain-deployer",
      display_name: "Log writer to AWS ES/Kibana",
      description: "Log writer to AWS ES/Kibana",
      deployment_type: "Deployer",
      deployer_role: "Install",
      hyperlinks: [
        { title: "TestlinkOne", url: "https://link.to.nowhere" },
        {
          title: "TestLinkTwo",
          url: "https://link.to.elsewhere",
        },
      ],
      db_migration_image: "plain-testing-migrationimage",
      last_deployment_timestamp: "2019-10-21T14:53:18.000Z",
      env: "dev",
    }

    let deploymentUIInfo = mapToUiVersion(input)
    expect(Boolean(deploymentUIInfo)).to.equal(true)
    if( deploymentUIInfo){
      expect(deploymentUIInfo.versionInfo).to.deep.equal(expectedVersionInfo)
      expect(deploymentUIInfo.deploymentInfo).to.deep.equal(expectedDeploymentInfo)
    }
  })

  it("should return undefined if not modified", () => {
    const input = getValidHerdDeployerMetadata()
    input.deploymentState.modified = false
    expect(mapToUiVersion(input)).to.equal(undefined)
  })

})
