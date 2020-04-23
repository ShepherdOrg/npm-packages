import {
  createUpstreamTriggerDeploymentConfig,
  IConfigureUpstreamDeployment,
} from "./create-upstream-trigger-deployment-config"
import { createFakeLogger } from "../test-tools/fake-logger"
import { OmitKey, THerdDeclaration } from "../deployment-types"

const expect = require("chai").expect

describe("Upstream triggered deployment config ", function() {
  describe("loading from process.env like config object, using image_url", function() {
    const configObject = {
      UPSTREAM_HERD_KEY: "envKey",
      UPSTREAM_IMAGE_URL: "registry:5000/envimagename:version-one",
      UPSTREAM_HERD_DESCRIPTION: "env description",
      FEATURE_NAME: "newNamein/allLowerCaps",
      FEATURE_TTL_HOURS: "999",
    }

    const expectedConfigObject = {
      imageFileName: "herdFilePath",
      upstreamHerdKey: "envKey",
      upstreamImageName: "registry:5000/envimagename",
      upstreamImageTag: "version-one",
      upstreamHerdDescription: "env description",
      branchName: "newnamein-alllowercaps",
      ttlHours: 999,
    }
    let config : IConfigureUpstreamDeployment

    before(() => {
      config = createUpstreamTriggerDeploymentConfig(createFakeLogger())
      config.loadFromEnvironment("herdFilePath", configObject)
    })

    it("should load from process.env like config object", () => {
      const coercedConfig = config as unknown as {[key:string]: any}
      Object.entries(expectedConfigObject).forEach(([key, value]) => {
        expect(coercedConfig[key]).to.equal(value)
      })
    })

    it("should be an upstream feature deployment", () => {
      expect(config.isUpstreamBranchDeployment()).to.equal(true)
    })
  })

  describe("loading from process.env like config object, using image fields", function() {
    const configObject = {
      UPSTREAM_HERD_KEY: "envKey",
      UPSTREAM_IMAGE_TAG: "version-one",
      UPSTREAM_IMAGE_NAME: "registry:5000/envimagename",
      UPSTREAM_HERD_DESCRIPTION: "env description",
      FEATURE_NAME: "newNamein/allLowerCaps",
      FEATURE_TTL_HOURS: "999",
    }

    const expectedConfigObject = {
      imageFileName: "herdFilePath",
      upstreamHerdKey: "envKey",
      upstreamImageName: "registry:5000/envimagename",
      upstreamImageTag: "version-one",
      upstreamHerdDescription: "env description",
      branchName: "newnamein-alllowercaps",
      ttlHours: 999,
    }
    let config : IConfigureUpstreamDeployment

    before(() => {
      config = createUpstreamTriggerDeploymentConfig(createFakeLogger())
      config.loadFromEnvironment("herdFilePath", configObject)
    })

    it("should load from process.env like config object", () => {
      const coercedConfig = config as unknown as {[key:string]: any}
      Object.entries(expectedConfigObject).forEach(([key, value]) => {
        expect(coercedConfig[key]).to.equal(value)
      })
    })

    it("should be an upstream branch deployment", () => {
      expect(config.isUpstreamBranchDeployment()).to.equal(true)
    })
  })

  describe("upstream deployment on master", function() {
    const configObject = {
      UPSTREAM_HERD_KEY: "envKey",
      UPSTREAM_IMAGE_URL: "envimagename:envtag",
      UPSTREAM_HERD_DESCRIPTION: "env description",
    }

    let herdImageDeclaration: OmitKey<THerdDeclaration & { dockerImage?: string; image: string; imagetag: string }>

    let config : IConfigureUpstreamDeployment

    before(() => {
      config = createUpstreamTriggerDeploymentConfig(createFakeLogger())
      config.loadFromEnvironment("herdFilePath", configObject)
      // @ts-ignore
      herdImageDeclaration = config.asHerd().images[configObject.UPSTREAM_HERD_KEY]
    })

    it("should require herd file edit", () => {
      expect(config.herdFileEditNeeded()).to.equal(true)
    })

    it("should not be marked as branch deployment", () => {
      expect(config.isUpstreamBranchDeployment()).to.equal(false)
    })

    it("should generate herd structure", () => {
      expect(herdImageDeclaration.image).to.equal("envimagename")
    })

    it("should extract description", () => {
      expect(herdImageDeclaration.description).to.equal("env description")
    })

    it("should extract imagetag", () => {
      expect(herdImageDeclaration.imagetag).to.equal("envtag")
    })

    it("should not be marked as branch deployment", () => {
      expect(herdImageDeclaration.featureDeployment).to.equal(undefined)
    })
  })

  describe("branch deployment", function() {
    const config = createUpstreamTriggerDeploymentConfig(console)

    before(() => {
      config.imageFileName = "herdFilePath"
      config.upstreamHerdKey = "thekey"
      config.upstreamImageName = "repo/someimage"
      config.upstreamImageTag = "9999"
      config.upstreamHerdDescription = "yet another test"
      config.branchName = "featuroUno"
      config.ttlHours = 676
    })

    it("should generate a herdfile like structure for creating a deployment plan for branch deployment", () => {
      let asHerd = config.asHerd()
      if(asHerd.images){
        let image = asHerd.images["thekey"]
        expect(image.image).to.equal("repo/someimage")
        expect(image.imagetag).to.equal("9999")
        expect(image.description).to.equal("yet another test")
        expect(image.timeToLiveHours).to.equal(676)
        expect(image.featureDeployment).to.equal(true)
      }
    })

    it("should not indicate herdfile modification", () => {
      expect(config.herdFileEditNeeded()).to.equal(false)
    })
  })

  describe("default config with no upstream information", function() {
    const config = createUpstreamTriggerDeploymentConfig(console)

    before(()=>{
      config.loadFromEnvironment('myHerdFile.yaml', {
      //  No relevant environment variable set in this case.
      })
    })

    it("should not indicate herdfile modification", () => {
      expect(config.herdFileEditNeeded()).to.equal(false)
    })

    it("should not be UpstreamFeatureDeployment by default", () => {
      expect(config.isUpstreamBranchDeployment()).to.equal(false)
    })

    it("should refuse to generate a herd structure without an upstream herd key", () => {
      try {
        config.asHerd()
        expect.fail("Should throw an error, asdf")
      } catch (err) {
        expect(err.message).to.equal(
          "Cannot construct a herd declaration from upstream config without an upstreamHerdKey"
        )
      }
    })
  })
})
