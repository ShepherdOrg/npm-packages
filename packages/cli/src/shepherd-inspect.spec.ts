import { strict as assert } from "node:assert"
import { describe, it } from "node:test"
import { TK8sMetadata } from "@shepherdorg/metadata"
import { inspectAndExtractShepherdMetadata } from "./shepherd-inspect"

describe.skip("NOT A UNIT TEST, shepherd inspect", function() {
  it("should inspect public-repo-with-kube-yaml image with shepherd.metadata label", () => {
    return inspectAndExtractShepherdMetadata(
      "public-repo-with-kube-yaml:latest"
    ).then(function() {
      return (shepherdLabels: TK8sMetadata) => {
        assert.strictEqual(shepherdLabels.dockerImageTag, "public-repo-with-kube-yaml:latest")
        assert.strictEqual(typeof shepherdLabels.kubeDeploymentFiles, "object")
      }
    })
  })
})
