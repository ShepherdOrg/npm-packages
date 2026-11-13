import { strict as assert } from "node:assert"
import { describe, it, before } from "node:test"
import { promisify } from "util"
import { exec as execCb } from "child_process"
const exec = promisify(execCb)

describe("Build docker with insufficient deployment information", function() {
  let shepherdMeta, buildOutput, buildExitCode
  let dockerMeta: any

  before(() => {
    let dockerDir = __dirname + '/insufficient-deployment-data'
    return exec(`./bin/shepherd-build-docker.sh ${dockerDir}/Dockerfile`).catch(({stdout, code}) => {
      buildOutput = stdout
      buildExitCode = code
    })
  })

  it("Implement should exit with error indicating problem", () => {
    assert.ok(buildOutput.includes('Missing SHEPHERD_METADATA label'))
    assert.ok(buildOutput.includes('${SHEPHERD_METADATA}'))
    assert.strictEqual(buildExitCode, 255)
  })

  it.skip("should suppress tslint warnings", () => {
    console.info(shepherdMeta)
    console.info(buildOutput)
    console.info(dockerMeta)
  })
})
