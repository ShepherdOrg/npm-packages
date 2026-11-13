import {
  createUpstreamTriggerDeploymentConfig,
  IConfigureUpstreamDeployment,
} from "./create-upstream-trigger-deployment-config"
import { createFakeLogger } from "@shepherdorg/logger"
import { OmitKey, THerdDeclaration } from "../deployment-types"

import { strict as assert } from "node:assert"
import { describe, it, before } from "node:test"

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
    let config: IConfigureUpstreamDeployment

    before(() => {
      config = createUpstreamTriggerDeploymentConfig(createFakeLogger())
      config.loadFromEnvironment("herdFilePath", configObject)
    })

    it("should load from process.env like config object", () => {
      const coercedConfig = (config as unknown) as { [key: string]: any }
      Object.entries(expectedConfigObject).forEach(([key, value]) => {
        assert.strictEqual(coercedConfig[key], value)
      })
    })

    it("should be an upstream feature deployment", () => {
      assert.strictEqual(config.isUpstreamBranchDeployment(), true)
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
    let config: IConfigureUpstreamDeployment

    before(() => {
      config = createUpstreamTriggerDeploymentConfig(createFakeLogger())
      config.loadFromEnvironment("herdFilePath", configObject)
    })

    it("should load from process.env like config object", () => {
      const coercedConfig = (config as unknown) as { [key: string]: any }
      Object.entries(expectedConfigObject).forEach(([key, value]) => {
        assert.strictEqual(coercedConfig[key], value)
      })
    })

    it("should be an upstream branch deployment", () => {
      assert.strictEqual(config.isUpstreamBranchDeployment(), true)
    })
  })

  describe("upstream deployment on master", function() {
    const configObject = {
      UPSTREAM_HERD_KEY: "envKey",
      UPSTREAM_IMAGE_URL: "envimagename:envtag",
      UPSTREAM_HERD_DESCRIPTION: "env description",
    }

    let herdImageDeclaration: OmitKey<THerdDeclaration & { dockerImage?: string; image: string; imagetag: string }>

    let config: IConfigureUpstreamDeployment

    before(() => {
      config = createUpstreamTriggerDeploymentConfig(createFakeLogger())
      config.loadFromEnvironment("herdFilePath", configObject)
      // @ts-ignore
      herdImageDeclaration = config.asHerd().images[configObject.UPSTREAM_HERD_KEY]
    })

    it("should require herd file edit", () => {
      assert.strictEqual(config.herdFileEditNeeded(), true)
    })

    it("should not be marked as branch deployment", () => {
      assert.strictEqual(config.isUpstreamBranchDeployment(), false)
    })

    it("should generate herd structure", () => {
      assert.strictEqual(herdImageDeclaration.image, "envimagename")
    })

    it("should extract description", () => {
      assert.strictEqual(herdImageDeclaration.description, "env description")
    })

    it("should extract imagetag", () => {
      assert.strictEqual(herdImageDeclaration.imagetag, "envtag")
    })

    it("should not be marked as branch deployment", () => {
      assert.strictEqual(herdImageDeclaration.featureDeployment, undefined)
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
      if (asHerd.images) {
        let image = asHerd.images["thekey"]
        assert.strictEqual(image.image, "repo/someimage")
        assert.strictEqual(image.imagetag, "9999")
        assert.strictEqual(image.description, "yet another test")
        assert.strictEqual(image.timeToLiveHours, 676)
        assert.strictEqual(image.featureDeployment, true)
      }
    })

    it("should not indicate herdfile modification", () => {
      assert.strictEqual(config.herdFileEditNeeded(), false)
    })
  })

  describe("default config with no upstream information", function() {
    const config = createUpstreamTriggerDeploymentConfig(console)

    before(() => {
      config.loadFromEnvironment("myHerdFile.yaml", {
        //  No relevant environment variable set in this case.
      })
    })

    it("should not indicate herdfile modification", () => {
      assert.strictEqual(config.herdFileEditNeeded(), false)
    })

    it("should not be UpstreamFeatureDeployment by default", () => {
      assert.strictEqual(config.isUpstreamBranchDeployment(), false)
    })

    it("should refuse to generate a herd structure without an upstream herd key", () => {
      try {
        config.asHerd()
        assert.fail("Should throw an error, asdf")
      } catch (err) {
        assert.strictEqual(err.message, "Cannot construct a herd declaration from upstream config without an upstreamHerdKey")
      }
    })
  })
})
