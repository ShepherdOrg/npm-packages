import { dockerImageMetadata, TDockerInspectMetadata } from "./local-image-metadata";
import { inject } from "@shepherdorg/nano-inject";
import { expect } from "chai";
import { TDockerImageLabels } from "./registry-metadata-client";
import { getTestCaseLogger } from "./testcase-logger";

const exec = require("exec");

describe("Image metadata loading", function(){
  this.timeout(60000);

  let testCaseLogger = getTestCaseLogger({debugOutput:false, infoOutput:false});

  const imageMetadataLoader = dockerImageMetadata(inject({exec:exec, logger: testCaseLogger}));

  it("should pull and inspect icelandair/shepherd image", () => {
    return imageMetadataLoader.pullAndInspectImage({image:"icelandair/shepherd", imagetag:"latest"}).then((imageMetadata:TDockerInspectMetadata)=>{
      expect(imageMetadata.dockerLabels["is.icelandairlabs.name"]).to.equal("Shepherd agent");
    });
  });

  it("should pull and inspect icelandair/shepherd image labels", () => {
    return imageMetadataLoader.pullAndInspectImageLabels({image:"icelandair/shepherd", imagetag:"latest"}).then((imageLabels:TDockerImageLabels)=>{
      expect(imageLabels["is.icelandairlabs.name"]).to.equal("Shepherd agent");
    });
  });
});