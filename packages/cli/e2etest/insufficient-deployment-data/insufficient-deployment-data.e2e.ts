import { readJsonFiles } from "../readJsonFiles"

const exec = require("child-process-promise").exec
const expect = require("chai").expect
const Future = require("fluture")
import * as path from "path"

xdescribe("Build docker with insufficient deployment information", function() {
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

  xit("TODO: Implement should exit with error indicating problem", () => {
    console.log("buildOutput", buildOutput)

    expect(buildOutput.indexOf("ERROR")).to.be.gte(0)
  })

  xit("should suppress tslint warnings", () => {
    console.log(shepherdMeta)
    console.log(buildOutput)
    console.log(dockerMeta)
  })
})
