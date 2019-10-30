import {
  CreateDeploymentInput,
  CreateDeploymentVersionInput,
  DeployerRole,
  DeploymentType,
} from "@shepherdorg/ui-graphql-client/dist/src/API"
import { THerdDeployerMetadata } from "./temptypes"
import { expect } from "chai"
import { getValidHerdDeployerMetadata } from "./testdata"
import { TDeployerRole, TDeploymentType } from "@shepherdorg/metadata/dist"

export type DeploymentUIInfo = {
  versionInfo: CreateDeploymentVersionInput
  deploymentInfo: CreateDeploymentInput
}

function mapDeploymentType(deploymentType: TDeploymentType) {
  const mapping: { [K in TDeploymentType]: DeploymentType } = {
    [TDeploymentType.Deployer]: DeploymentType.Deployer,
    [TDeploymentType.Kubernetes]: DeploymentType.Kubernetes,
  }
  return mapping[deploymentType]
}

function mapDeployerRole(deployerRole: TDeployerRole) {
  const mapping: { [K in TDeployerRole]: DeployerRole } = {
    [TDeployerRole.Infrastructure]: DeployerRole.Infrastructure,
    [TDeployerRole.Install]: DeployerRole.Install,
    [TDeployerRole.Migration]: DeployerRole.Migration,
  }
  return mapping[deployerRole]
}

describe("mapping", function() {
  function mapToUiVersion(
    deployerInfo: THerdDeployerMetadata
  ): DeploymentUIInfo {
    function mapLinks() {
      if (deployerInfo.hyperlinks) {
        return deployerInfo.hyperlinks.map(link => {
          return { title: link.title, url: link.url }
        })
      } else {
        return []
      }
    }

    if (deployerInfo.deploymentState.timestamp) {
      let deployedAt = deployerInfo.deploymentState.timestamp.toISOString()
      return {
        versionInfo: {
          buildHostName: deployerInfo.buildHostName || "build host is unknown",
          builtAt: deployerInfo.buildDate.toISOString(),
          deployedAt: deployedAt,
          deploymentVersionDeploymentId:
            deployerInfo.deploymentState.env + deployerInfo.herdSpec.key,
          dockerImage: deployerInfo.dockerImageTag || "missing docker image", // TODO Must fix in metadata library
          dockerImageTag:
            deployerInfo.dockerImageTag || "missing docker image tag",
          env: deployerInfo.deploymentState.env,
          gitBranch: deployerInfo.deploymentState.env,
          gitCommit: deployerInfo.gitCommit || "missing",
          gitHash: deployerInfo.gitHash,
          gitUrl: deployerInfo.gitUrl,
          kubernetesDeploymentFiles: [],
          lastCommits: deployerInfo.lastCommits,
          version: deployerInfo.semanticVersion,
          versionId:
            deployerInfo.deploymentState.env +
            deployerInfo.herdSpec.key +
            deployerInfo.deploymentState.version +
            deployedAt,
        },
        deploymentInfo: {
          id: deployerInfo.deploymentState.env + deployerInfo.herdSpec.key,
          displayName:
            deployerInfo.herdSpec.description || deployerInfo.displayName,
          description: deployerInfo.herdSpec.description,
          deploymentType: mapDeploymentType(deployerInfo.deploymentType),
          deployerRole: mapDeployerRole(deployerInfo.deployerRole),
          dbMigrationImage: deployerInfo.migrationImage,
          hyperlinks: mapLinks(),
          lastDeploymentTimestamp: deployedAt,
          env: deployerInfo.deploymentState.env,
        },
      }
    } else {
      throw new Error(
        "Deployment lacks sufficient information for pushing to UI!"
      )
    }
  }

  it("should map deployer info to UI", () => {
    const input = getValidHerdDeployerMetadata()

    const expectedVersionInfo = {
      buildHostName: "Gulaugurs-MacBook-Pro.local",
      builtAt: "2019-10-21T14:53:18.000Z",
      deployedAt: "2019-10-21T14:53:18.000Z",
      deploymentVersionDeploymentId: "devdev-images-plain-deployer",
      dockerImage: "plain-deployer-repo:latest",
      dockerImageTag: "plain-deployer-repo:latest",
      env: "dev",
      gitBranch: "dev",
      gitCommit: "2153e378877c0deaa2a3ee2491800d40f5212bc5",
      gitHash: "062b591",
      gitUrl: "git@github.com:ShepherdOrg/npm-packages.git",
      kubernetesDeploymentFiles: [],
      lastCommits:
        " Sun, 20 Oct 2019 17:55:38 +0000 by Guðlaugur S. Egilsson. --- Metadata updates and a few more fixes. \n\n Wed, 9 Oct 2019 13:52:56 +0000 by Guðlaugur S. Egilsson. --- First pass on shepherd-inspect, not ready at all though. \n\n Mon, 7 Oct 2019 14:28:50 +0000 by Guðlaugur S. Egilsson. --- Adding json schema for validating shepherd.json config file \n\n Fri, 4 Oct 2019 15:00:24 +0000 by Guðlaugur S. Egilsson. --- Introducing npm installable build docker script. Changing docker label for metadata packaging \n",
      version: "latest",
      versionId:
        "devdev-images-plain-deployer999.999.999992019-10-21T14:53:18.000Z",
    }

    let expectedDeploymentInfo = {
      id: "devdev-images-plain-deployer",
      displayName: "Log writer to AWS ES/Kibana",
      description: "Log writer to AWS ES/Kibana",
      deploymentType: "Deployer",
      deployerRole: "Install",
      hyperlinks: [
        { title: "TestlinkOne", url: "https://link.to.nowhere" },
        {
          title: "TestLinkTwo",
          url: "https://link.to.elsewhere",
        },
      ],
      dbMigrationImage: "plain-testing-migrationimage",
      lastDeploymentTimestamp: "2019-10-21T14:53:18.000Z",
      env: "dev",
    }

    let deploymentUIInfo = mapToUiVersion(input)
    expect(deploymentUIInfo.versionInfo).to.deep.equal(expectedVersionInfo)
    expect(deploymentUIInfo.deploymentInfo).to.deep.equal(
      expectedDeploymentInfo
    )
  })
})
