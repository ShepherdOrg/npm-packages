import { strict as assert } from "node:assert"
import { describe, it, before, after } from "node:test"
import { promisify } from "util"
import { exec as execCb } from "child_process"
const exec = promisify(execCb)
import { promises as fs } from "fs"

describe("Verify installation of last published version in a docker, but with latest version of shepherd-build-docker ", function() {
  let buildExitCode

  before(async () => {
    let dockerDir = __dirname
    await fs.copyFile(
      `./bin/shepherd-build-docker.sh`,
      `${dockerDir}/test/node_modules/@shepherdorg/cli/bin/shepherd-build-docker.sh`
    )
    await exec(`./bin/shepherd-build-docker.sh ${dockerDir}/Dockerfile`)
      .then(({}) => {
        /*
        console.debug(`Docker build completed without error`)
        console.debug(`stdout`, stdout)
        console.debug(`stderr`, stderr)
*/
        buildExitCode = 0
      })
      .catch(({ code }) => {
        /*
        console.debug(`COMPLETED WITH ERROR CODE=`, code)
        console.debug(`stdout`, stdout)
        console.debug(`stderr`, stderr)
*/
        buildExitCode = code
      })
  })

  after(async () => {
    await fs.unlink(`${__dirname}/test/node_modules/@shepherdorg/cli/bin/shepherd-build-docker.sh`)
  })

  it("Should simply exit without error", () => {
    assert.strictEqual(buildExitCode, 0)
  })
})
