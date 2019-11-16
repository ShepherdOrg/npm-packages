const CreateUpstreamTriggerDeploymentConfig = require("./create-upstream-trigger-deployment-config")
  .CreateUpstreamTriggerDeploymentConfig
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
      newName: "newnamein-alllowercaps",
      ttlHours: 999,
    }
    let config

    before(() => {
      config = CreateUpstreamTriggerDeploymentConfig({ info: () => {} })
      config.loadFromEnvironment("herdFilePath", configObject)
    })

    it("should load from process.env like config object", () => {
      Object.entries(expectedConfigObject).forEach(([key, value]) => {
        expect(config[key]).to.equal(value)
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

    let config

    before(() => {
      config = CreateUpstreamTriggerDeploymentConfig({ info: () => {} })
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
      config.newName = "featuroUno"
      config.ttlHours = "676"
    })

    it("should generate a herdfile like structure for creating a deployment plan for branch deployment", () => {
      let asHerd = config.asHerd()
      expect(asHerd.images["thekey"].image).to.equal("repo/someimage")
      expect(asHerd.images["thekey"].imagetag).to.equal("9999")
      expect(asHerd.images["thekey"].description).to.equal("yet another test")
      expect(asHerd.images["thekey"].timeToLiveHours).to.equal("676")
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
