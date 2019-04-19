import { inject } from "@shepherdorg/nano-inject";
import { getTestCaseLogger, ILog } from "./testcase-logger";
import { expect } from "chai";
import { imageLabelsLoader } from "./image-labels-loader";
import {
  getDockerRegistryClientsFromConfig
} from "./docker-registry-clients-config";
import { TDockerInspectMetadata } from "./local-image-metadata";


describe("Loading image labels", function() {
  this.timeout(60000)
  let testLogger: ILog;
  let loader;

  const dockerRegistries = getDockerRegistryClientsFromConfig();
//  var dockerRegistries = getLocalhostTestingDockerRegistryClients();


  beforeEach(function() {
    testLogger = getTestCaseLogger({ debugOutput: true, infoOutput: false });
    loader = imageLabelsLoader(inject({ logger: testLogger, dockerRegistries:dockerRegistries }));
  })

  describe('hub.docker.com registry by pulling and inspecting', function() {
    it("should pull remote registry and inspect", () => {
      return loader.getImageLabels({
        image: "icelandair/shepherd",
        imagetag: "latest"
      }).then((imageLabels: TDockerInspectMetadata) => {
        expect(imageLabels.dockerLabels["is.icelandairlabs.name"]).to.eql("Shepherd agent");
        expect(testLogger.debugEntries).to.contain("icelandair/shepherd:latest metadata loaded using docker inspect");
      });
    });

  })

  describe('localhost registry', function() {
    it("should load image metadata from registry API", () => {
      return loader.getImageLabels({
        image: "localhost:5000/shepherd",
        imagetag: "latest"
      }).then((imageLabels: TDockerInspectMetadata) => {
        expect(imageLabels.dockerLabels["is.icelandairlabs.name"]).to.eql("Shepherd agent");
        console.log('testLogger.debugEntries', JSON.stringify(testLogger.debugEntries))
        expect(testLogger.debugEntries).to.contain("localhost:5000/shepherd:latest metadata loaded using registry API");
      });
    });
  })

  describe('localhost semi-secure registry', function() {

    before(() => {
      process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
    });

    it("should load image metadata from registry API", () => {
      return loader.getImageLabels({
        image: "localhost:5500/shepherd",
        imagetag: "latest"
      }).then((imageLabels: TDockerInspectMetadata) => {
        expect(imageLabels.dockerLabels["is.icelandairlabs.name"]).to.eql("Shepherd agent");
        expect(testLogger.debugEntries).to.contain("localhost:5500/shepherd:latest metadata loaded using registry API");
      });
    });
  })

});