import { expect } from "chai"
import { exec } from "child-process-promise"

describe("Build docker with insufficient deployment information", function() {
  this.timeout(10000)
  let shepherdMeta, buildOutput, buildExitCode
  let dockerMeta: any

  before(() => {
    let dockerDir = __dirname
    return exec(`./bin/shepherd-build-docker.sh ${dockerDir}/Dockerfile`).catch(({stdout, code}) => {
      buildOutput = stdout
      buildExitCode = code
    })
  })

  it("Implement should exit with error indicating problem", () => {
    expect(buildOutput).to.contain('Missing SHEPHERD_METADATA label')
    expect(buildExitCode).to.equal(255)
  })

  xit("should suppress tslint warnings", () => {
    console.info(shepherdMeta)
    console.info(buildOutput)
    console.info(dockerMeta)
  })
})
