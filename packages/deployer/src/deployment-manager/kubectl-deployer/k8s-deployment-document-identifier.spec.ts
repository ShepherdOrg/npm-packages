import * as fs from "fs"
import { expect } from "chai"
import { identifyDocument } from "./k8s-deployment-document-identifier"

describe("k8s deployment document identifier", function() {

  let descriptorsInDoc
  let fileIdentity

  before(()=>{
    let rawYamlDoc = fs.readFileSync(
      __dirname + "/testdata/multipart-deployment.yaml",
      { encoding: "UTF-8" }
    )

    let identifier1 = identifyDocument(rawYamlDoc)
    fileIdentity = identifier1.identifyingString
    descriptorsInDoc = identifier1.descriptorsByKind
  })

  it("should be ok with multipart document using LF separator", function() {
    expect(fileIdentity).to.equal("kube-system_ServiceAccount_fluentd")
  })

  it("should identify all deployments in document", () => {
    expect(descriptorsInDoc['Deployment'].length).to.equal(2)
  })


})
