import { expect } from "chai"
import { exec } from "child-process-promise"
import { promises as fs } from "fs"

describe("Verify installation of last published version in a docker, but with latest version of shepherd-build-docker ", function() {
  /* This test as a double chicken-and-egg factor
   *  - It uses shepherd-build-docker to build an image to check shepherd-build-docker inside an image.
   *  - It installs cli from npmjs.com and runs it inside the image, with an overwritten version of shepherd-build-docker.
   *
   * This means that this is not a good test for developing the cli with large changes. You would want to create
   * another variant of this test that uses the local code differently
   *  */

  this.timeout(10000)
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
        console.log(`DEBUG Docker build completed without error`)
        console.log(`DEBUG stdout`, stdout)
        console.log(`DEBUG stderr`, stderr)
*/
        buildExitCode = 0
      })
      .catch(({ code }) => {
        /*
        console.log(`DEBUG COMPLETED WITH ERROR CODE=`, code)
        console.log(`DEBUG stdout`, stdout)
        console.log(`DEBUG stderr`, stderr)
*/
        buildExitCode = code
      })
  })

  after(async () => {
    await fs.unlink(`${__dirname}/test/node_modules/@shepherdorg/cli/bin/shepherd-build-docker.sh`)
  })

  it("Should simply exit without error", () => {
    expect(buildExitCode).to.equal(0)
  })
})
