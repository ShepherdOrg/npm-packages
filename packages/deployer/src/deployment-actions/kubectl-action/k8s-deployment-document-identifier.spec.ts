import * as fs from "fs"
import { strict as assert } from "node:assert"
import { describe, it, before } from "node:test"
import { identifyDocument, TDescriptorsByKind } from "./k8s-deployment-document-identifier"

describe("k8s deployment document identifier", function() {

  let descriptorsInDoc: TDescriptorsByKind
  let fileIdentity: string

  before(()=>{
    let rawYamlDoc = fs.readFileSync(
      __dirname + "/testdata/multipart-deployment.yaml",
      { encoding: "utf-8" }
    )

    let identifier1 = identifyDocument(rawYamlDoc)
    fileIdentity = identifier1.identifyingString
    descriptorsInDoc = identifier1.descriptorsByKind
  })

  it("should be ok with multipart document using LF separator", function() {
    assert.strictEqual(fileIdentity, "kube-system_ServiceAccount_fluentd")
  })

  it("should identify all deployments in document", () => {
    assert.strictEqual(descriptorsInDoc['Deployment'].length, 2)
  })


})
