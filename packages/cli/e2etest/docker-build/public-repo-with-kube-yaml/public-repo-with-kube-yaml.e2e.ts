import { expect } from "chai"
import { exec } from "child-process-promise"

describe("Build docker with kube.yaml deployment", function() {
  this.timeout(10000)
  let shepherdMeta, buildOutput
  let dockerMeta: any

  before(() => {
    let dockerDir = __dirname
    return exec(`./bin/shepherd-build-docker.sh ${dockerDir}/Dockerfile`).then(
      ({ stdout, stderr }) => {
        if (stderr) expect.fail("GOT ERROR> " + stderr)

        shepherdMeta = require(__dirname + '/.build/metadata/shepherd.json')
        buildOutput = stdout

        return exec(
          "docker inspect public-repo-with-kube-yaml:latest"
        ).then(({ stdout }) => {
          dockerMeta = JSON.parse(stdout)
        })
      }
    )
  })

  it("should have kubeConfigB64", () => {
    expect(shepherdMeta.kubeConfigB64.length).to.equal(684)
  })

  xit("should suppress tslint warnings", () => {
    console.log(shepherdMeta)
    console.log(buildOutput)
    console.log(dockerMeta)
  })
})
