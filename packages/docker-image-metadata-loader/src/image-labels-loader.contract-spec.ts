import { getTestCaseLogger, ITestLog } from "./testcase-logger"
import { expect } from "chai"
import { imageLabelsLoader } from "./image-labels-loader"
import { TDockerRegistryClientMap } from "./docker-registry-clients-config"
import { TDockerInspectMetadata } from "./local-image-metadata"
import { getLocalhostTestingDockerRegistryClients } from "./local-testing-docker-registry-clients-config"

describe("Loading image labels", function() {
  this.timeout(60000)
  let testLogger: ITestLog
  let loader

  // const dockerRegistries = getDockerRegistryClientsFromConfig();
  const dockerRegistries: TDockerRegistryClientMap = getLocalhostTestingDockerRegistryClients()

  beforeEach(function() {
    testLogger = getTestCaseLogger({ debugOutput: false, infoOutput: false, warnOutput:false })
    loader = imageLabelsLoader(
      { logger: testLogger, dockerRegistries: dockerRegistries }
    )
  })

  describe("hub.docker.com registry by pulling and inspecting", function() {
    it("should pull remote registry and inspect", () => {
      return loader
        .getImageLabels({
          image: "shepherdorg/shepherd",
          imagetag: "latest",
        })
        .then((imageLabels: TDockerInspectMetadata) => {
          expect(imageLabels.dockerLabels["shepherd.name"]).to.eql(
            "Shepherd agent"
          )
          expect(testLogger.debugEntries).to.contain(
            "shepherdorg/shepherd:latest metadata loaded using docker inspect"
          )
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
          expect(imageLabels.dockerLabels["shepherd.name"]).to.eql(
            "Shepherd agent"
          )
          expect(testLogger.debugEntries).to.contain(
            "localhost:5000/shepherd:latest metadata loaded using registry API"
          )
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
          expect(imageLabels.dockerLabels["shepherd.name"]).to.eql(
            "Shepherd agent"
          )
          expect(testLogger.debugEntries.join("\n")).to.contain(
            "localhost:5500/shepherd:latest metadata loaded using registry API"
          )
        })
    })
  })
})
