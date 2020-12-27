import { TDeployerMetadata, TDeployerRole, TDeploymentType, TTestSpecification } from "@shepherdorg/metadata"

function initTestDataDsl(instance: TDeployerMetadata, ownerDsl: IShepherdMetadataDsl, testSpec: TTestSpecification): ITestDataDsl {

  let testSpecDsl = {
    instance: ownerDsl.instance,
    addEnv(envSpecStr: string){
      testSpec.inEnvironments.push(envSpecStr)
      return testSpecDsl
    }
  }
  return testSpecDsl

}

export interface ITestDataDsl {
  instance(): TDeployerMetadata

  addEnv(envSpecString: string): ITestDataDsl
}

export interface IShepherdMetadataDsl {
  dockerImageUrl(url: string): IShepherdMetadataDsl

  instance(): TDeployerMetadata

  addPreDeploymentTest(command: string, testenv: string): ITestDataDsl

  addPostDeploymentTest(command: string, testenv: string): ITestDataDsl
}

export function metadataDsl() {
  let defaultInstance: TDeployerMetadata = {
    deployerRole: TDeployerRole.Install,
    environmentVariablesExpansionString: "",
    buildDate: new Date("2020-02-19T09:35:58+00:00"),
    buildHostName: "Gudlaugurs-MacBook-Pro.local",
    dockerImageUrl: "test-deployer-image-with-deployment-tests:0.7.77-NOT_IN_GIT",
    dockerImageGithash: "test-deployer-image-with-deployment-tests:0.7.77-NOT_IN_GIT",
    gitHash: "NOT_IN_GIT",
    gitBranch: "master",
    gitUrl: "git@github.com:ShepherdOrg/npm-packages.git",
    gitCommit: "4391a8e7dd04e80a7050a9a92461bac2ae67f4af",
    lastCommits: "\n",
    semanticVersion: "0.7.77",
    displayName: "Migration testimage newformat using environment value",
    environment: [
      {
        name: "MIGRATION_ENV_VARIABLE_TWO",
        value: "fixedValue",
        secret: true,
      },
    ],
    deployCommand: "ls",
    rollbackCommand: "cat",
    preDeploymentTests: [],
    postDeploymentTests: [],
    hyperlinks: [
      {
        title: "Sources for this",
        url: "https://github.com/shepherdorg/npm-packages/packages/deployer/src/integratedtest/testimages/test-image-with-e2etest",
      },
    ],
    deploymentType: "deployer" as TDeploymentType,
  }
  let dsl: IShepherdMetadataDsl = {
    dockerImageUrl(url: string) {
      defaultInstance.dockerImageUrl = url
      return dsl
    },
    instance(): TDeployerMetadata {
      return defaultInstance
    },
    addPreDeploymentTest(command: string, testenv: string) {
      if (!defaultInstance.preDeploymentTests) {
        defaultInstance.preDeploymentTests = []
      }
      let testSpec = {
        command: command,
        inEnvironments: [testenv],
      }
      defaultInstance.preDeploymentTests.push(testSpec)

      const testDataDsl = initTestDataDsl(defaultInstance, dsl, testSpec)
      return testDataDsl
    }, addPostDeploymentTest(command: string, testenv: string) {
      if (!defaultInstance.postDeploymentTests) {
        defaultInstance.postDeploymentTests = []
      }
      let testSpec = {
        command: command,
        inEnvironments: [testenv],
      }
      defaultInstance.postDeploymentTests.push(testSpec)

      return initTestDataDsl(defaultInstance, dsl, testSpec)
    },
  }
  return dsl
}
