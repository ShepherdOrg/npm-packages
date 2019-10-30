import { readJsonFiles } from "../readJsonFiles"

const exec = require("child-process-promise").exec
const expect = require("chai").expect
const Future = require("fluture")
import * as path from "path"

describe("Build docker with kube.yaml deployment", function() {
  this.timeout(10000)
  let shepherdMeta, buildOutput
  let dockerMeta: any

  before(() => {
    let dockerDir = __dirname
    return exec(`./bin/shepherd-build-docker.sh ${dockerDir}/Dockerfile`).then(
      ({ stdout, stderr }) => {
        if (stderr) expect.fail("GOT ERROR> " + stderr)

        buildOutput = stdout

        return Future.promise(
          readJsonFiles(path.join(__dirname, "/.build"), "**/*/shepherd.json")
        ).then(metaFiles => {
          shepherdMeta = metaFiles[0]

          return exec(
            "docker inspect public-repo-with-deployment-dir:latest"
          ).then(({ stdout }) => {
            dockerMeta = JSON.parse(stdout)
          })
        })
      }
    )
  })

  it("should not have kubeConfigB64", () => {
    expect(shepherdMeta.kubeConfigB64).to.equal(undefined)
  })

  it("should have metadata for deploy command", () => {
    expect(shepherdMeta.deployCommand).to.equal("ls")
  })

  it("should have metadata for rollback command", () => {
    expect(shepherdMeta.rollbackCommand).to.equal("cat")
  })

  xit("should suppress tslint warnings", () => {
    console.log(shepherdMeta)
    console.log(buildOutput)
    console.log(dockerMeta)
  })
})
