import { THerdDeployerMetadata } from "./temptypes"
import { TDeployerRole, TDeploymentType } from "@shepherdorg/metadata/dist"

export function getValidHerdDeployerMetadata() {
  const input: THerdDeployerMetadata = {
    deploymentState: {
      new: false,
      key: "dev-images-plain-deployer",
      modified: true,
      operation: "apply",
      version: "999.999.99999",
      lastVersion: "999.999.99998",
      timestamp: new Date("2019-10-21T14:53:18+00:00"),
      signature: "shasignatureforchangedetection",
      env: "dev",
    },
    deploymentType: TDeploymentType.Deployer,
    herdSpec: {
      key: "dev-images-plain-deployer",
      image: "isrvkbuild02:5000/fluentd",
      imagetag: "v1.1.2-g-2b48d1c",
      description: "Log writer to AWS ES/Kibana",
    },
    buildDate: new Date("2019-10-21T14:53:18+00:00"),
    buildHostName: "Gulaugurs-MacBook-Pro.local",
    dockerImageTag: "plain-deployer-repo:latest",
    migrationImage: "plain-testing-migrationimage",
    // "dockerImageGithash": "plain-deployer-repo:latest-062b591",
    gitHash: "062b591",
    gitBranch: "master",
    gitUrl: "git@github.com:ShepherdOrg/npm-packages.git",
    gitCommit: "2153e378877c0deaa2a3ee2491800d40f5212bc5",
    lastCommits:
      " Sun, 20 Oct 2019 17:55:38 +0000 by Guðlaugur S. Egilsson. --- Metadata updates and a few more fixes. \n\n Wed, 9 Oct 2019 13:52:56 +0000 by Guðlaugur S. Egilsson. --- First pass on shepherd-inspect, not ready at all though. \n\n Mon, 7 Oct 2019 14:28:50 +0000 by Guðlaugur S. Egilsson. --- Adding json schema for validating shepherd.json config file \n\n Fri, 4 Oct 2019 15:00:24 +0000 by Guðlaugur S. Egilsson. --- Introducing npm installable build docker script. Changing docker label for metadata packaging \n",
    semanticVersion: "latest",
    displayName: "Plain shepherd deployer",
    deployerRole: TDeployerRole.Install,
    // "environment": {
    //     "DB_HOST": "MICROSERVICES_POSTGRES_RDS_HOST",
    //     "DB_PASS": "MICRO_SITES_DB_PASSWORD"
    // },
    environmentVariablesExpansionString:
      "DB_HOST=${MICRO_DEPLOYER_DB_PASSWORD}",
    deployCommand: "ls",
    rollbackCommand: "cat",
    hyperlinks: [
      {
        title: "TestlinkOne",
        url: "https://link.to.nowhere",
      },
      {
        title: "TestLinkTwo",
        url: "https://link.to.elsewhere",
      },
    ],
  }
  return {...input}
}
