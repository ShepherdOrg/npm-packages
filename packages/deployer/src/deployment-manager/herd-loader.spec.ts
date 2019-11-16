import { expect } from "chai"

const HerdLoader = require("./herd-loader")
const inject = require("@shepherdorg/nano-inject").inject
const exec = require("@shepherdorg/exec")
const fakeLogger = require("../test-tools/fake-logger")
import * as path from "path"
import * as fs from "fs"

/// Inject a mock image metadata loader with fake image information

const CreateFeatureDeploymentConfig = require('./create-upstream-trigger-deployment-config').CreateUpstreamTriggerDeploymentConfig

describe("herd.yaml loading", function() {
  let labelsLoader
  let loader
  let CreateReleasePlan
  let loaderLogger

  let featureDeploymentConfig = CreateFeatureDeploymentConfig()

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

  function createTestHerdLoader(labelsLoader, featureDeploymentConfig) {
    loader = HerdLoader(
      inject({
        logger: loaderLogger,
        ReleasePlan: CreateReleasePlan,
        exec: exec,
        labelsLoader: labelsLoader,
        featureDeploymentConfig,
      })
    )
  }

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

    CreateReleasePlan = function() {
      let releasePlan = {
        addedDockerDeployers: {},
        addedK8sDeployments: {},
        addDeployment(deployment) {
          return new Promise(function(resolve, reject) {
            if (!deployment.type) {
              let message = "Illegal deployment, no deployment type attribute in " + JSON.stringify(deployment)
              reject(message)
            }
            if (!deployment.identifier) {
              let message = "Illegal deployment, no identifier attribute in " + JSON.stringify(deployment)
              reject(message)
            }
            if (deployment.type === "k8s") {
              releasePlan.addedK8sDeployments[deployment.identifier] = deployment
            } else if (deployment.type === "deployer") {
              releasePlan.addedDockerDeployers[deployment.identifier] = deployment
            }
            resolve({ fakeState: true })
          })
        },
      }
      return releasePlan
    }

    loaderLogger = fakeLogger()

    labelsLoader = {
      getDockerRegistryClientsFromConfig() {
        return {}
      },
      imageLabelsLoader() {
        return {
          getImageLabels(imageDef) {
            let dockerImageMetadataFile = path.join(
              __dirname,
              "testdata",
              "inspected-dockers",
              imageDef.image + ".json"
            )
            if (fs.existsSync(dockerImageMetadataFile)) {
              const dockerInspection = require(dockerImageMetadataFile)

              return Promise.resolve({
                dockerLabels: dockerInspection[0].ContainerConfig.Labels,
                imageDefinition: imageDef,
              })
            } else {
              return Promise.reject(
                new Error(`dockerImageMetadataFile ${dockerImageMetadataFile} not found in testdata`)
              )
            }
          },
        }
      },
    }

    createTestHerdLoader(labelsLoader, featureDeploymentConfig)
  })

  it("should load herd.yaml", function() {
    return loader.loadHerd(__dirname + "/testdata/happypath/herd.yaml").then(function(plan) {
      expect(plan).not.to.equal(undefined)
    })
  })

  it("should not log any execution after herd load.", function() {
    return loader.loadHerd(__dirname + "/testdata/happypath/herd.yaml").then(function(plan) {
      expect(plan).not.to.equal(undefined)
      expect(loaderLogger.infoLogEntries.length).to.equal(4)
    })
  })

  it("should fail if file does not exist", function() {
    loader
      .loadHerd(__dirname + "/testdata/does-not-exist.yaml")
      .then(function() {
        expect.fail("Should not finish!")
      })
      .catch(function(error) {
        expect(error).to.contain("/testdata/does-not-exist.yaml does not exist!")
      })
  })

  describe("directory execution plan", function() {
    let loadedPlan

    before(() => {
      process.env.GLOBAL_MIGRATION_ENV_VARIABLE_ONE = "anotherValue"
    })

    after(() => {
      delete process.env.GLOBAL_MIGRATION_ENV_VARIABLE_ONE
    })

    beforeEach(function() {
      return loader.loadHerd(__dirname + "/testdata/happypath/herd.yaml").then(function(plan) {
        loadedPlan = plan
      })
    })

    it("should add k8s deployment found in scanned directory", function() {
      // expect().fail('LOADED PLAN' + JSON.stringify(loadedPlan, null, 2))

      expect(loadedPlan.addedK8sDeployments["Namespace_monitors"].origin).to.equal("namespaces")
    })

    it("loaded plan should have herd name", function() {
      // expect().fail('LOADED PLAN' + JSON.stringify(loadedPlan, null, 2))

      expect(loadedPlan.addedK8sDeployments["Namespace_monitors"].herdKey).to.contain("kube-config - namespaces")
    })

    it("should have herdspec", () => {
      expect(loadedPlan.addedK8sDeployments["Namespace_monitors"].herdSpec.herdKey).to.equal("kube-config")
      expect(loadedPlan.addedK8sDeployments["Namespace_monitors"].herdSpec.path).to.equal("./")
      expect(loadedPlan.addedK8sDeployments["Namespace_monitors"].herdSpec.description).to.equal(
        "Kubernetes pull secrets, namespaces, common config"
      )
    })

    it("should have metadata", () => {
      let expectedMetadata = {
        displayName: "monitors-namespace.yml",
        semanticVersion: "0",
        deploymentType: "k8s",
        buildDate: new Date(0), // Might make sense to extract change timestamp on file from filesystem or git
        hyperlinks: [],
      }
      expect(loadedPlan.addedK8sDeployments["Namespace_monitors"].metadata).to.deep.equal(expectedMetadata)
    })
  })

  describe("k8s feature deployment plan", function() {
    let loadedPlan

    before(() => {
      featureDeploymentConfig.imageFileName = "feature-deployment"
      featureDeploymentConfig.upstreamHerdKey = "herdkeyone"
      featureDeploymentConfig.upstreamImageName = "testenvimage"
      featureDeploymentConfig.upstreamImageTag = "9999"
      featureDeploymentConfig.upstreamHerdDescription = "Very much a testing image"
      featureDeploymentConfig.upstreamFeatureDeployment = true
      featureDeploymentConfig.ttlHours = '22'
      featureDeploymentConfig.newName = 'feature-XYZ'
    })

    after(()=>{
      featureDeploymentConfig.upstreamFeatureDeployment = false

      delete featureDeploymentConfig.imageFileName
      delete featureDeploymentConfig.upstreamHerdKey
      delete featureDeploymentConfig.upstreamImageName
      delete featureDeploymentConfig.upstreamImageTag
      delete featureDeploymentConfig.upstreamHerdDescription
      delete featureDeploymentConfig.ttlHours
      delete featureDeploymentConfig.newName
    })

    beforeEach(function() {
      return loader.loadHerd(__dirname + "/testdata/happypath/herd.yaml").then(function(plan) {
        loadedPlan = plan
      })
    })

    it("should create plan from feature deployment config", () => {
      let addedK8sDeployments = Object.keys(loadedPlan.addedK8sDeployments)
      let addedDockerDeployers = Object.keys(loadedPlan.addedDockerDeployers)

      expect(addedK8sDeployments.join(", ")).to.contain("feature-xyz")
      expect(addedDockerDeployers.join(", ")).to.contain("testenvimage-migrations:0.0.0") // Referred migration image
    })
  })

  describe("k8s deployment plan", function() {
    let loadedPlan

    before(() => {
      process.env.CLUSTER_POLICY_MAX_CPU_REQUEST = "25m"
      process.env.GLOBAL_MIGRATION_ENV_VARIABLE_ONE = "anotherValue"
    })

    beforeEach(function() {
      createTestHerdLoader(labelsLoader, featureDeploymentConfig)
      return loader.loadHerd(__dirname + "/testdata/happypath/herd.yaml").then(function(plan) {
        loadedPlan = plan
      })
    })

    after(() => {
      delete process.env.CLUSTER_POLICY_MAX_CPU_REQUEST
      delete process.env.GLOBAL_MIGRATION_ENV_VARIABLE_ONE
    })

    it("should base64decode and untar deployment files under file path", function() {
      expect(loadedPlan.addedK8sDeployments["Service_www-icelandair-com"].origin).to.equal(
        "testenvimage:0.0.0:kube.config.tar.base64"
      )
    })

    it("should extract herdKey from herd.yaml", function() {
      expect(loadedPlan.addedK8sDeployments["Service_www-icelandair-com"].herdKey).to.equal("test-image")
    })

    it("should include metadata for k8s plan", function() {
      let addedK8sDeployment = loadedPlan.addedK8sDeployments["Service_www-icelandair-com"]
      expect(addedK8sDeployment.metadata).not.to.equal(undefined)

      expect(addedK8sDeployment.metadata.displayName).to.equal("Testimage")
      expect(addedK8sDeployment.herdSpec.herdKey).to.equal("test-image", "herdKey")
    })

    it("should modify deployment documents and file under deployments under k8s service identity", function() {
      expect(loadedPlan.addedK8sDeployments["Service_www-icelandair-com"].descriptor).not.to.contain("${EXPORT2}")
    })

    it("should apply k8s deployment-time cluster policy", function() {
      // expect(JSON.stringify(Object.keys(loadedPlan),undefined,2)).to.contain('25m');
      expect(loadedPlan.addedK8sDeployments["Deployment_www-icelandair-com"].descriptor).to.contain("25m")
    })

    it("should be serializable", function() {
      function detectRecursion(obj) {
        function detect(obj, seenObjects) {
          if (obj && typeof obj === "object") {
            if (seenObjects.indexOf(obj) !== -1) {
              return ["RECURSION!"]
            }
            seenObjects.push(obj)
            for (let key in obj) {
              if (obj.hasOwnProperty(key)) {
                let detected = detect(obj[key], seenObjects)
                if (detected.length) {
                  detected.unshift(key)
                  return detected
                }
              }
            }
            seenObjects.pop()
          }
          return []
        }

        return detect(obj, [])
      }

      let serializable = detectRecursion(loadedPlan)
      expect(serializable.join(".")).to.equal("")
      expect(serializable.length).to.equal(0)
    })
  })

  describe("deployer execution plan", function() {
    let loadedPlan:any

    beforeEach(function() {
      process.env.GLOBAL_MIGRATION_ENV_VARIABLE_ONE = "happyValueOne"
      return loader.loadHerd(__dirname + "/testdata/happypath/herd.yaml").then(function(plan) {
        loadedPlan = plan
      })
    })

    afterEach(() => {
      delete process.env.GLOBAL_MIGRATION_ENV_VARIABLE_ONE
    })

    it("should  have herdSpec and metadata on all loaded plans", () => {

      Object.entries(loadedPlan.addedK8sDeployments as Array<any>).forEach(function([_dname, deployment]) {
        expect(deployment.herdSpec.herdKey).not.to.equal(undefined)
        expect(deployment.metadata.displayName).not.to.equal(undefined)
      })
      Object.entries(loadedPlan.addedDockerDeployers as Array<any>).forEach(function([_dname, deployment]) {
        expect(deployment.herdSpec.herdKey).not.to.equal(undefined)
        expect(deployment.metadata.displayName).not.to.equal(undefined)
      })
    })

    it("should load deployer plan by migration image reference", function() {
      expect(loadedPlan.addedDockerDeployers["testenvimage-migrations:0.0.0"].dockerParameters).to.contain(
        "testenvimage-migrations:0.0.0"
      )
      expect(Object.keys(loadedPlan.addedDockerDeployers)).to.contain("testenvimage-migrations:0.0.0")
    })

    it("should forward metadata with execution plan", () => {
      expect(loadedPlan.addedDockerDeployers["testenvimage-migrations:0.0.0"].herdSpec).to.deep.equal({
        dockerImage: "testenvimage-migrations:0.0.0",
        herdKey: "testenvimage-migrations:0.0.0",
        image: "testenvimage-migrations",
        imagetag: "0.0.0",
      })
    })
  })

  xdescribe("SLOW TEST: non-existing image", function() {
    let loadError

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

    xit("should not output stderr from docker calls unless end result is an error", function() {})
  })
})
