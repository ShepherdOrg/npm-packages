
const exec = require("child-process-promise").exec
const expect = require("chai").expect

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
    console.log(shepherdMeta)
    console.log(buildOutput)
    console.log(dockerMeta)
  })
})
