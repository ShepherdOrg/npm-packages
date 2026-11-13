import { dockerImageMetadata, TDockerInspectMetadata } from "./local-image-metadata"
import { strict as assert } from "node:assert"
import { describe, it } from "node:test"
import { TDockerImageLabels } from "./registry-metadata-client"
import { getTestCaseLogger } from "./testcase-logger"
import { ILog } from "./index"

const exec = require("@shepherdorg/ts-exec").exec

describe("Image metadata loading", function() {

  let testCaseLogger = getTestCaseLogger({
    debugOutput: false,
    infoOutput: false,
    warnOutput: false,
  })

  const imageMetadataLoader = dockerImageMetadata({ exec: exec, logger: testCaseLogger as ILog })

  it("should pull and inspect shepherdorg/shepherd image", () => {
    return imageMetadataLoader
      .inspectImage({ image: "shepherdorg/shepherd", imagetag: "latest" })
      .then((imageMetadata: TDockerInspectMetadata) => {
        assert.strictEqual(imageMetadata.dockerLabels["shepherd.name"], "Shepherd agent")
      })
  })

  it("should pull and inspect shepherdorg/shepherd image labels", () => {
    return imageMetadataLoader
      .inspectImageLabels({ image: "shepherdorg/shepherd", imagetag: "latest" })
      .then((imageLabels: TDockerImageLabels) => {
        assert.strictEqual(imageLabels["shepherd.name"], "Shepherd agent")
      })
  })

  it.skip("should retry once to get bullshit image", () => {
    return imageMetadataLoader
      .inspectImageLabels({ image: "thisisatest/foobartwice", imagetag: "latest" })
      .then((imageLabels: TDockerImageLabels) => {
        assert.strictEqual(imageLabels["shepherd.name"], "Shepherd agent")
      })
      .catch(loadFailure => {
        console.log(`loadFailure`, loadFailure)
      })
  })
})
