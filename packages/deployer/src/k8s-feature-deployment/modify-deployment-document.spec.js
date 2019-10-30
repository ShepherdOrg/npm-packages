const JsDiff = require("diff")
const fs = require("fs")
const expect = require("expect.js")
const _ = require("lodash")

const modifyRawDoc = require("./modify-deployment-document").modifyRawDocument

function containsDifference(diffArray) {
  for (let diffObj of diffArray) {
    if (diffObj.removed || diffObj.added) {
      return true
    }
  }
  return false
}

function renderDifferences(diffArray) {
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

function compareActualVsExpected(expectedFileName, actualFileName) {
  let expectedFileContents = fs.readFileSync(expectedFileName, "utf-8")
  let actualFileContents = fs.readFileSync(actualFileName, "utf-8")
  let difference = JsDiff.diffTrimmedLines(
    expectedFileContents.trim(),
    actualFileContents.trim()
  )
  if (containsDifference(difference)) {
    expect().fail(
      "Expected file " +
        expectedFileName +
        " differs from actual file " +
        actualFileName +
        "\n" +
        renderDifferences(difference)
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

  it("should modify all parts in multipart document", () => {
    const rawdoc = fs.readFileSync(__dirname + "/testdata/kube.yaml", "utf-8")

    const modifiedRawDoc = modifyRawDoc(rawdoc, {
      ttlHours: 66,
      newName: "new/branch",
    })

    let modifiedKubeYaml = actualDir + "/kube.yaml"

    fs.writeFileSync(modifiedKubeYaml, modifiedRawDoc, "utf-8")

    compareActualVsExpected(
      __dirname + "/testdata/expected/kube.yaml",
      modifiedKubeYaml
    )
  })
})
