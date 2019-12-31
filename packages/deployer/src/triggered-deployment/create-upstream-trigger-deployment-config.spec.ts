import {
  CreateUpstreamTriggerDeploymentConfig,
  TFeatureDeploymentConfig,
} from "./create-upstream-trigger-deployment-config"
import { CreateFakeLogger } from "../test-tools/fake-logger"

const expect = require("chai").expect

describe("Upstream triggered deployment config ", function() {
  describe("loading from process.env like config object", function() {
    const configObject = {
      UPSTREAM_HERD_KEY: "envKey",
      UPSTREAM_IMAGE_NAME: "envimagename",
      UPSTREAM_IMAGE_TAG: "envtag",
      UPSTREAM_HERD_DESCRIPTION: "env description",
      FEATURE_NAME: "newNamein/allLowerCaps",
      FEATURE_TTL_HOURS: "999",
    }

    const expectedConfigObject = {
      imageFileName: "herdFilePath",
      upstreamHerdKey: "envKey",
      upstreamImageName: "envimagename",
      upstreamImageTag: "envtag",
      upstreamHerdDescription: "env description",
      branchName: "newnamein-alllowercaps",
      ttlHours: 999,
    }
    let config : TFeatureDeploymentConfig

    before(() => {
      config = CreateUpstreamTriggerDeploymentConfig(CreateFakeLogger())
      config.loadFromEnvironment("herdFilePath", configObject)
    })

    it("should load from process.env like config object", () => {
      const coercedConfig = config as unknown as {[key:string]: any}
      Object.entries(expectedConfigObject).forEach(([key, value]) => {
        expect(coercedConfig[key]).to.equal(value)
      })
    })

    it("should be an upstream feature deployment", () => {
      expect(config.isUpstreamFeatureDeployment()).to.equal(true)
    })
  })

  describe("upstream deployment with no feature deployment", function() {
    const configObject = {
      UPSTREAM_HERD_KEY: "envKey",
      UPSTREAM_IMAGE_NAME: "envimagename",
      UPSTREAM_IMAGE_TAG: "envtag",
      UPSTREAM_HERD_DESCRIPTION: "env description",
    }

    let config : TFeatureDeploymentConfig

    before(() => {
      config = CreateUpstreamTriggerDeploymentConfig(CreateFakeLogger())
      config.loadFromEnvironment("herdFilePath", configObject)
    })

    it("should require herd file edit", () => {
      expect(config.herdFileEditNeeded()).to.equal(true)
    })

    it("should not be upstream triggered", () => {
      expect(config.isUpstreamFeatureDeployment()).to.equal(false)
    })
  })

  describe("branch deployment", function() {
    const config = CreateUpstreamTriggerDeploymentConfig(console)

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
    const config = CreateUpstreamTriggerDeploymentConfig(console)

    before(()=>{
      config.loadFromEnvironment('myHerdFile.yaml', {
      //  No relevant environment variable set in this case.
      })
    })

    it("should not indicate herdfile modification", () => {
      expect(config.herdFileEditNeeded()).to.equal(false)
    })

    it("should not be UpstreamFeatureDeployment by default", () => {
      expect(config.isUpstreamFeatureDeployment()).to.equal(false)
    })

    it("should refuse to generate a herd structure for a non-branch deployment", () => {
      try {
        config.asHerd()
        expect.fail("Should throw an error, asdf")
      } catch (err) {
        expect(err.message).to.equal(
          "Upstream config does not contain enough information for upstream feature deployment configuration!"
        )
      }
    })
  })
})
