import { expect } from "chai"
import { TK8sMetadata } from "@shepherdorg/metadata"
import { inspectAndExtractShepherdMetadata } from "./shepherd-inspect"

xdescribe("NOT A UNIT TEST, shepherd inspect", function() {
  it("should inspect public-repo-with-kube-yaml image with shepherd.metadata label", () => {
    return inspectAndExtractShepherdMetadata(
      "public-repo-with-kube-yaml:latest"
    ).then(function() {
      return (shepherdLabels: TK8sMetadata) => {
        expect(shepherdLabels.dockerImageTag).to.equal(
          "public-repo-with-kube-yaml:latest"
        )
        expect(shepherdLabels.kubeDeploymentFiles).to.be.an("object")
      }
    })
  })
})
