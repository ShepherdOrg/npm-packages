import { expect } from "chai"
import * as path from "path"
import { execCmd } from "../../src/exec/exec-cmd"

const shellExec = require('shell-exec')

describe("Build docker with deployment dir", function() {
  this.timeout(10000)
  let shepherdMeta, buildOutput
  let dockerMeta: any

  before(() => {
    let dockerDir = path.join(__dirname, 'public-repo-with-deployment-dir')

    return execCmd(`./bin/shepherd-build-docker.sh`, [`${dockerDir}/Dockerfile`] ).then(
      ({ stdout, stderr }) => {
        if (stderr) expect.fail("GOT ERROR> " + stderr)

        buildOutput = stdout
        shepherdMeta = require(dockerDir + '/.build/metadata/shepherd.json')

        return shellExec(
          "docker inspect public-repo-with-deployment-dir:latest"
        ).then(({ stdout }) => {
          dockerMeta = JSON.parse(stdout)
        })

      }
    )
  })

  // it('should spew out build output', () => {
  //     console.info('buildOutput', buildOutput)
  // });

  it("should have shepherd.metadata as a label in docker metadata", () => {
    // console.info('dockerMeta[0]', JSON.stringify(dockerMeta[0]))
    expect(dockerMeta[0].Config.Labels["shepherd.metadata"].length).to.be.gte(
      1000
    )
  })

  it("should not warn of unconsumed variables", () => {
    expect(buildOutput.indexOf("were not consumed")).to.equal(-1)
  })

  it("should have kubeConfigB64", () => {
    expect(shepherdMeta.kubeConfigB64.length).to.be.gte(684)
  })

  it("should have correct buildHostName property", () => {
    expect(shepherdMeta.hasOwnProperty("buildHostName")).to.equal(true)
  })

  it("should have correct dockerImageTag property", () => {
    expect(shepherdMeta.dockerImageUrl).to.contain(
      "public-repo-with-deployment-dir"
    )
  })

  it("should have correct dockerImageGithash property", () => {
    expect(shepherdMeta.dockerImageGithash).to.contain(
      "public-repo-with-deployment-dir"
    )
  })

  it("should have correct gitUrl property", () => {
    expect(shepherdMeta.gitUrl).to.equal(
      "git@github.com:ShepherdOrg/npm-packages.git"
    )
  })

  it("should have correct gitCommit property", () => {
    expect(shepherdMeta.hasOwnProperty("gitCommit")).to.equal(true)
  })

  it("should have correct lastCommits property", () => {
    expect(shepherdMeta.hasOwnProperty("lastCommits")).to.equal(true)
  })
})
