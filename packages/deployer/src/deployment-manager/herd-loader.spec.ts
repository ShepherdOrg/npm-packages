import { expect } from "chai"

import { HerdLoader, TDockerMetadataLoader, THerdLoader } from "./herd-loader"
import * as path from "path"
import * as fs from "fs"
import {
  FReleasePlanner,
  ILog,
  TActionExecutionOptions,
  TDockerDeploymentAction,
  TFolderHerdSpec,
  TK8sDirDeploymentAction,
  TK8sDockerImageDeploymentAction,
  TReleasePlan,
} from "./deployment-types"
import { detectRecursion } from "../helpers/obj-functions"
import { CreateFakeLogger, IFakeLogging } from "../test-tools/fake-logger"
import { TFileSystemPath } from "../basic-types"
import { TFeatureDeploymentConfig } from "./create-upstream-trigger-deployment-config"

const exec = require("@shepherdorg/exec")

/// Inject a mock image metadata loader with fake image information


const CreateFeatureDeploymentConfig = require("./create-upstream-trigger-deployment-config").CreateUpstreamTriggerDeploymentConfig

export type TTestReleasePlan =
  TReleasePlan
  & {
  addedK8sDeploymentActions: { [key: string]: TK8sDockerImageDeploymentAction | TK8sDirDeploymentAction }
  addedDockerDeployerActions: { [key: string]: TDockerDeploymentAction }
}

type FCreateTestReleasePlan = () => TTestReleasePlan

describe("herd.yaml loading", function() {
  let labelsLoader: TDockerMetadataLoader
  let loader: THerdLoader
  let CreateTestReleasePlan: FCreateTestReleasePlan
  let loaderLogger: IFakeLogging

  let featureDeploymentConfig = CreateFeatureDeploymentConfig()

  function createTestHerdLoader(labelsLoader: TDockerMetadataLoader, featureDeploymentConfig: TFeatureDeploymentConfig) {
    loader = HerdLoader(
      {
        logger: loaderLogger,
        ReleasePlan: CreateTestReleasePlan as FReleasePlanner,
        exec: exec,
        labelsLoader: labelsLoader,
        featureDeploymentConfig,
      },
    )
  }

  afterEach(() => {
    delete process.env.www_icelandair_com_image
    delete process.env.SUB_DOMAIN_PREFIX
    delete process.env.PREFIXED_TOP_DOMAIN_NAME
    delete process.env.MICROSERVICES_POSTGRES_RDS_HOST
    delete process.env.MICRO_SITES_DB_PASSWORD
    delete process.env.WWW_ICELANDAIR_IP_WHITELIST
    delete process.env.EXPORT1
    delete process.env.EXPORT2
    delete process.env.GLOBAL_MIGRATION_ENV_VARIABLE_ONE
  })


  beforeEach(() => {
    process.env.www_icelandair_com_image = "testimage123"
    process.env.SUB_DOMAIN_PREFIX = "testing123"
    process.env.PREFIXED_TOP_DOMAIN_NAME = "testing123"
    process.env.MICROSERVICES_POSTGRES_RDS_HOST = "testing123"
    process.env.MICRO_SITES_DB_PASSWORD = "testing123"
    process.env.WWW_ICELANDAIR_IP_WHITELIST = "YnVsbHNoaXRsaXN0Cg=="
    process.env.GLOBAL_MIGRATION_ENV_VARIABLE_ONE = "anotherValue"

    delete process.env.TPL_DOCKER_IMAGE

    process.env.EXPORT1 = "NotFromInfrastructureAnyMore"
    process.env.EXPORT2 = "NeitherFromInfrastructure"


    CreateTestReleasePlan = function() {
      let addedK8sDeployerActions: { [key: string]: TK8sDockerImageDeploymentAction } = {}
      let addedDockerDeployerActions: { [key: string]: TDockerDeploymentAction } = {}
      let releasePlan: TTestReleasePlan = {
        executePlan: function(_p1: TActionExecutionOptions) {
          return Promise.resolve([])
        },
        exportDeploymentDocuments: function(_p1: TFileSystemPath) {
          return Promise.resolve()
        },
        printPlan: function(_p1: ILog) {
        },
        addedDockerDeployerActions: addedDockerDeployerActions,
        addedK8sDeploymentActions: addedK8sDeployerActions,
        addDeployment(deployment: TK8sDockerImageDeploymentAction | TDockerDeploymentAction) {
          return new Promise(function(resolve, reject) {
            if (!deployment.type) {
              let message = "Illegal deployment, no deployment type attribute in " + JSON.stringify(deployment)
              reject(new Error(message))
            }
            if (!deployment.identifier) {
              let message = "Illegal deployment, no identifier attribute in " + JSON.stringify(deployment)
              reject(new Error(message))
            }
            if (deployment.type === "k8s") {
              releasePlan.addedK8sDeploymentActions[deployment.identifier] = deployment as TK8sDockerImageDeploymentAction
            } else if (deployment.type === "deployer") {
              releasePlan.addedDockerDeployerActions[deployment.identifier] = deployment as TDockerDeploymentAction
            }
            resolve(undefined)
          })
        },
      }
      return releasePlan
    }

    loaderLogger = CreateFakeLogger()

    labelsLoader = {
      getDockerRegistryClientsFromConfig() {
        return {}
      },
      imageLabelsLoader(_injected: any) {
        return {
          getImageLabels(imageDef) {
            let dockerImageMetadataFile = path.join(
              __dirname,
              "testdata",
              "inspected-dockers",
              imageDef.image + ".json",
            )
            if (fs.existsSync(dockerImageMetadataFile)) {
              const dockerInspection = require(dockerImageMetadataFile)

              return Promise.resolve({
                dockerLabels: dockerInspection[0].ContainerConfig.Labels,
                imageDefinition: imageDef,
              })
            } else {
              return Promise.reject(
                new Error(`dockerImageMetadataFile ${dockerImageMetadataFile} not found in testdata`),
              )
            }
          },
        }
      },
    }

    createTestHerdLoader(labelsLoader, featureDeploymentConfig)
  })

  it("should load herd.yaml", function() {
    return loader
      .loadHerd(__dirname + "/testdata/happypath/herd.yaml").then(function(plan) {
        expect(plan).not.to.equal(undefined)
      })
  })

  it("should not log any execution after herd load.", function() {
    return loader.loadHerd(__dirname + "/testdata/happypath/herd.yaml").then(function(plan) {
      expect(plan).not.to.equal(undefined)
      expect(loaderLogger.infoLogEntries.length).to.eq(1)
    })
  })

  it("should fail if file does not exist", function() {
    loader
      .loadHerd(__dirname + "/testdata/does-not-exist.yaml")
      .then(function() {
        expect.fail("Should not finish!")
      })
      .catch(function(error) {
        expect(error.message).to.contain("/testdata/does-not-exist.yaml does not exist!")
      })
  })

  describe("directory execution plan", function() {
    let loadedPlan: TTestReleasePlan

    before(() => {
      process.env.GLOBAL_MIGRATION_ENV_VARIABLE_ONE = "anotherValue"
    })

    after(() => {
      delete process.env.GLOBAL_MIGRATION_ENV_VARIABLE_ONE
    })

    beforeEach(function() {
      return loader.loadHerd(__dirname + "/testdata/happypath/herd.yaml").then(function(plan) {
        loadedPlan = plan as TTestReleasePlan
      })
    })

    it("should add k8s deployment found in scanned directory", function() {
      expect(loadedPlan.addedK8sDeploymentActions["Namespace_monitors"].origin).to.equal("namespaces/monitors-namespace.yml")
    })

    it("loaded plan should have herd name", function() {
      // expect().fail('LOADED PLAN' + JSON.stringify(loadedPlan, null, 2))

      expect(loadedPlan.addedK8sDeploymentActions["Namespace_monitors"].herdKey).to.contain("kube-config - namespaces")
    })

    it("should have herdspec", () => {
      expect(loadedPlan.addedK8sDeploymentActions["Namespace_monitors"].herdSpec.key).to.equal("kube-config")
      expect((loadedPlan.addedK8sDeploymentActions["Namespace_monitors"].herdSpec as TFolderHerdSpec).path).to.equal("./")
      expect(loadedPlan.addedK8sDeploymentActions["Namespace_monitors"].herdSpec.description).to.equal(
        "Kubernetes pull secrets, namespaces, common config",
      )
    })

    it("should have metadata in dir execution plan", () => {
      let expectedMetadata = {
        displayName: "monitors-namespace.yml",
        semanticVersion: "none",
        deploymentType: "k8s",
        path: "namespaces/monitors-namespace.yml",
        buildDate: "2019-02-15T09:33:58.000Z",
        hyperlinks: [],
      }
      expect(loadedPlan.addedK8sDeploymentActions["Namespace_monitors"].metadata).to.deep.equal(expectedMetadata)
    })
  })

  describe("k8s feature deployment plan", function() {
    let loadedPlan: TTestReleasePlan

    before(() => {
      featureDeploymentConfig.imageFileName = "feature-deployment"
      featureDeploymentConfig.upstreamHerdKey = "herdkeyone"
      featureDeploymentConfig.upstreamImageName = "testenvimage"
      featureDeploymentConfig.upstreamImageTag = "9999"
      featureDeploymentConfig.upstreamHerdDescription = "Very much a testing image"
      featureDeploymentConfig.upstreamFeatureDeployment = true
      featureDeploymentConfig.ttlHours = "22"
      featureDeploymentConfig.branchName = "feature-XYZ"
    })

    after(() => {
      featureDeploymentConfig.upstreamFeatureDeployment = false

      delete featureDeploymentConfig.imageFileName
      delete featureDeploymentConfig.upstreamHerdKey
      delete featureDeploymentConfig.upstreamImageName
      delete featureDeploymentConfig.upstreamImageTag
      delete featureDeploymentConfig.upstreamHerdDescription
      delete featureDeploymentConfig.ttlHours
      delete featureDeploymentConfig.branchName
    })

    beforeEach(function() {
      return loader.loadHerd(__dirname + "/testdata/happypath/herd.yaml").then(function(plan) {
        loadedPlan = plan as TTestReleasePlan
      })
    })


    it("should create plan from feature deployment config", () => {
      let addedK8sDeploymentActions = Object.keys(loadedPlan.addedK8sDeploymentActions)
      let addedDockerDeployerActions = Object.keys(loadedPlan.addedDockerDeployerActions)

      expect(addedK8sDeploymentActions.join(", ")).to.contain("feature-xyz")
      expect(addedDockerDeployerActions.join(", ")).to.contain("testenvimage-migrations:0.0.0") // Referred migration image
    })
  })

  describe("k8s deployment plan", function() {
    let loadedPlan: TTestReleasePlan

    before(() => {
      process.env.CLUSTER_POLICY_MAX_CPU_REQUEST = "25m"
      process.env.GLOBAL_MIGRATION_ENV_VARIABLE_ONE = "anotherValue"
    })

    beforeEach(function() {
      createTestHerdLoader(labelsLoader, featureDeploymentConfig)
      return loader.loadHerd(__dirname + "/testdata/happypath/herd.yaml").then(function(plan) {
        loadedPlan = plan as TTestReleasePlan
      })
    })

    after(() => {
      delete process.env.CLUSTER_POLICY_MAX_CPU_REQUEST
      delete process.env.GLOBAL_MIGRATION_ENV_VARIABLE_ONE
    })

    it("should base64decode and untar deployment files under file path", function() {
      expect(loadedPlan.addedK8sDeploymentActions["Service_www-icelandair-com"].origin).to.equal(
        "testenvimage:0.0.0:tar:./deployment/www-icelandair-com.service.yml",
      )
    })

    // it("should extract herdKey from herd.yaml", function() {
    //   // console.log('loadedPlan.addedK8sDeploymentActions["Service_www-icelandair-com"]', loadedPlan.addedK8sDeploymentActions["Service_www-icelandair-com"])
    //   expect(loadedPlan.addedK8sDeploymentActions["Service_www-icelandair-com"].herdKey).to.equal("test-image")
    // })

    it("should include metadata for k8s plan", function() {
      let addedK8sDeployment = loadedPlan.addedK8sDeploymentActions["Service_www-icelandair-com"]
      expect(addedK8sDeployment.metadata).not.to.equal(undefined)

      expect(addedK8sDeployment.metadata.displayName).to.equal("Testimage")
      expect(addedK8sDeployment.herdSpec.key).to.equal("test-image", "key")
    })

    it("should modify deployment documents and file under deployments under k8s service identity", function() {
      expect(loadedPlan.addedK8sDeploymentActions["Service_www-icelandair-com"].descriptor).not.to.contain("${EXPORT2}")
    })

    it("should apply k8s deployment-time cluster policy", function() {
      // expect(JSON.stringify(Object.keys(loadedPlan),undefined,2)).to.contain('25m');
      expect(loadedPlan.addedK8sDeploymentActions["Deployment_www-icelandair-com"].descriptor).to.contain("25m")
    })

    it("should be serializable", function() {

      let serializable = detectRecursion(loadedPlan)
      expect(serializable.join(".")).to.equal("")
      expect(serializable.length).to.equal(0)
    })
  })

  describe("deployer execution plan", function() {
    let loadedPlan: TTestReleasePlan

    beforeEach(function() {
      process.env.GLOBAL_MIGRATION_ENV_VARIABLE_ONE = "happyValueOne"
      return loader.loadHerd(__dirname + "/testdata/happypath/herd.yaml").then(function(plan) {
        loadedPlan = plan as TTestReleasePlan
      })
    })

    afterEach(() => {
      delete process.env.GLOBAL_MIGRATION_ENV_VARIABLE_ONE
    })

    it("should  have herdSpec and metadata on all loaded plans", () => {

      Object.entries(loadedPlan.addedK8sDeploymentActions).forEach(function([_dname, deployment]) {
        expect(deployment.herdSpec.key).not.to.equal(undefined)
        expect(deployment.metadata.displayName).not.to.equal(undefined)
      })
      Object.entries(loadedPlan.addedDockerDeployerActions).forEach(function([_dname, deployment]) {
        expect(deployment.herdSpec.key).not.to.equal(undefined)
        expect(deployment.metadata.displayName).not.to.equal(undefined)
      })
    })

    it("should load deployer plan by migration image reference", function() {
      expect(loadedPlan.addedDockerDeployerActions["testenvimage-migrations:0.0.0"
        ].dockerParameters).to.contain(
        "testenvimage-migrations:0.0.0",
      )
      expect(Object.keys(loadedPlan.addedDockerDeployerActions)).to.contain("testenvimage-migrations:0.0.0")
    })

    it("should forward metadata with execution plan", () => {
      expect(loadedPlan.addedDockerDeployerActions["testenvimage-migrations:0.0.0"].herdSpec).to.deep.equal({
        key: "testenvimage-migrations:0.0.0",
        image: "testenvimage-migrations",
        imagetag: "0.0.0",
      })
    })
  })

  xdescribe("SLOW TEST: non-existing image", function() {
    let loadError: Error

    // beforeEach(function() {
    //     originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    //     jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;
    // });

    beforeEach(function() {
      return loader.loadHerd(__dirname + "/testdata/nonexistingimage/herd.yaml")
    })

    it("should fail with meaningful error message", function() {
      expect(loadError).to.contain("nonexistingimage:0.0.0")
    })

    xit("should not output stderr from docker calls unless end result is an error", function() {
    })
  })
})
