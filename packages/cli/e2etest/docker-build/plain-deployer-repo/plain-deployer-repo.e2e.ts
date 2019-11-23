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
          "docker inspect plain-deployer-repo:latest"
        ).then(({ stdout }) => {
          dockerMeta = JSON.parse(stdout)
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

  it("should have docker metadata", () => {
    expect(dockerMeta[0].Id).not.to.equal(undefined)
  })


  xit("should suppress tslint warnings", () => {
    console.info(shepherdMeta)
    console.info(buildOutput)
    console.info(dockerMeta)
  })
})
