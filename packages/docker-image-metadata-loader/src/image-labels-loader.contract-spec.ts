import { getTestCaseLogger, ITestLog } from "./testcase-logger"
import { strict as assert } from "node:assert"
import { describe, it, before, beforeEach } from "node:test"
import { ILoadDockerImageLabels, imageLabelsLoader } from "./image-labels-loader"
import { TDockerRegistryClientMap } from "./docker-registry-clients-config"
import { TDockerInspectMetadata } from "./local-image-metadata"
import { getLocalhostTestingDockerRegistryClients } from "./local-testing-docker-registry-clients-config"

describe("Loading image labels", function() {
  let testLogger: ITestLog
  let loader: ILoadDockerImageLabels

  // const dockerRegistries = getDockerRegistryClientsFromConfig();
  const dockerRegistries: TDockerRegistryClientMap = getLocalhostTestingDockerRegistryClients()

  beforeEach(function() {
    testLogger = getTestCaseLogger({ debugOutput: false, infoOutput: false, warnOutput: false })
    loader = imageLabelsLoader({ logger: testLogger, dockerRegistries: dockerRegistries })
  })

  describe("hub.docker.com registry by pulling and inspecting", function() {
    it("should pull remote registry and inspect", () => {
      return loader
        .getImageLabels({
          image: "shepherdorg/shepherd",
          imagetag: "latest",
        })
        .then((imageLabels: TDockerInspectMetadata) => {
          assert.deepStrictEqual(imageLabels.dockerLabels["shepherd.name"], "Shepherd agent")
          assert.ok(testLogger.debugEntries.includes("shepherdorg/shepherd:latest metadata loaded using docker inspect"))
        })
    })
  })

  describe("hub.docker.com registry by pulling and inspecting unknown image", function() {
    it("should pull remote registry and inspect without showing error output", () => {
      return loader
        .getImageLabels({
          image: "bullshitimage/notexisting",
          imagetag: "latest",
        })
        .catch(imageInspectError => {
          assert.ok(imageInspectError.message.includes("bullshitimage/notexisting:latest"))
        })
    })
  })

  describe("localhost registry", function() {
    it("should load image metadata from registry API", () => {
      return loader
        .getImageLabels({
          image: "localhost:5000/shepherd",
          imagetag: "latest",
        })
        .then((imageLabels: TDockerInspectMetadata) => {
          assert.deepStrictEqual(imageLabels.dockerLabels["shepherd.name"], "Shepherd agent")
          assert.ok(testLogger.debugEntries.includes("localhost:5000/shepherd:latest metadata loaded using registry API"))
        })
    })
  })

  describe("localhost semi-secure registry", function() {
    before(() => {
      process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0"
    })

    it("should load image metadata from registry API FAILING", () => {
      return loader
        .getImageLabels({
          image: "localhost:5500/shepherd",
          imagetag: "latest",
        })
        .then((imageLabels: TDockerInspectMetadata) => {
          assert.deepStrictEqual(imageLabels.dockerLabels["shepherd.name"], "Shepherd agent")
          assert.ok(testLogger.debugEntries.join("\n").includes("localhost:5500/shepherd:latest metadata loaded using registry API"))
        })
    })
  })
})
