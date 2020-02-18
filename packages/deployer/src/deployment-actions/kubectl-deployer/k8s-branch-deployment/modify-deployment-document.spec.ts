import * as JsDiff from "diff"
import { Change } from "diff"
import * as fs from "fs"
import { modifyDeploymentDocument } from "./modify-deployment-document"

const expect = require("expect.js")
const CreateUpstreamTriggerDeploymentConfig = require('../../../triggered-deployment/create-upstream-trigger-deployment-config').CreateUpstreamTriggerDeploymentConfig

function containsDifference(differences:Change[]) {
  for (let diffObj of differences) {
    if (diffObj.removed || diffObj.added) {
      return true
    }
  }
  return false
}

function renderDifferences(diffArray:Change[]) {
  let result = ""
  for (let diffObj of diffArray) {
    if (diffObj.added) {
      result += "\n        not expecting: " + diffObj.value
    }
    if (diffObj.removed) {
      result += "\nexpecting but missing: " + diffObj.value
    }
  }
  return result
}

function compareActualVsExpected(expectedFileName:string, actualFileName: string) {
  let expectedFileContents = fs.readFileSync(expectedFileName, "utf-8")
  let actualFileContents = fs.readFileSync(actualFileName, "utf-8")
  let differences = JsDiff.diffTrimmedLines(
    expectedFileContents.trim(),
    actualFileContents.trim()
  )
  if (containsDifference(differences)) {
    expect().fail(
      "Expected file " +
        expectedFileName +
        " differs from actual file " +
        actualFileName +
        "\n" +
        renderDifferences(differences)
    )
  }
}

describe("modify k8s deployment document", function() {
  let actualDir = process.cwd() + "/.build/actual"

  before(() => {
    if (!fs.existsSync(actualDir)) {
      fs.mkdirSync(actualDir)
    }
  })

  it("should modify all parts in multipart document ", () => {
    const rawdoc = fs.readFileSync(__dirname + "/testdata/kube.yaml", "utf-8")

    let featureDeploymentConfig = CreateUpstreamTriggerDeploymentConfig(console)
    featureDeploymentConfig.branchName = 'new-branch'
    featureDeploymentConfig.ttlHours = 66

    const modifiedRawDoc = modifyDeploymentDocument(rawdoc, featureDeploymentConfig)

    let modifiedKubeYaml = actualDir + "/kube.yaml"

    fs.writeFileSync(modifiedKubeYaml, modifiedRawDoc, "utf-8")

    compareActualVsExpected(
      __dirname + "/testdata/expected/kube.yaml",
      modifiedKubeYaml
    )
  })

})
