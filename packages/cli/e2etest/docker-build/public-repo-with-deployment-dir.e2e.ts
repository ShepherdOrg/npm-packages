import { strict as assert } from "node:assert"
import { describe, it, before } from "node:test"
import * as path from "path"
import { execCmd } from "../../src/exec/exec-cmd"

const shellExec = require("shell-exec").default

describe("Build docker with deployment dir", function() {
  let shepherdMeta, buildOutput
  let dockerMeta: any

  before(() => {
    let dockerDir = path.join(__dirname, 'public-repo-with-deployment-dir')

    return execCmd(`./bin/shepherd-build-docker.sh`, [`${dockerDir}/Dockerfile`] ).then(
      ({ stdout, stderr }) => {
        if (stderr) assert.fail("GOT ERROR> " + stderr)

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
    assert.ok(dockerMeta[0].Config.Labels["shepherd.metadata"].length >= 1000)
  })

  it("should not warn of unconsumed variables", () => {
    assert.strictEqual(buildOutput.indexOf("were not consumed"), -1)
  })

  it("should have kubeConfigB64", () => {
    assert.ok(shepherdMeta.kubeConfigB64.length >= 684)
  })

  it("should have correct buildHostName property", () => {
    assert.strictEqual(shepherdMeta.hasOwnProperty("buildHostName"), true)
  })

  it("should have correct dockerImageTag property", () => {
    assert.ok(shepherdMeta.dockerImageUrl.includes("public-repo-with-deployment-dir"))
  })

  it("should have correct dockerImageGithash property", () => {
    assert.ok(shepherdMeta.dockerImageGithash.includes("public-repo-with-deployment-dir"))
  })

  it("should have correct gitUrl property", () => {
    assert.strictEqual(shepherdMeta.gitUrl, "git@github.com:ShepherdOrg/npm-packages.git")
  })

  it("should have correct gitCommit property", () => {
    assert.strictEqual(shepherdMeta.hasOwnProperty("gitCommit"), true)
  })

  it("should have correct lastCommits property", () => {
    assert.strictEqual(shepherdMeta.hasOwnProperty("lastCommits"), true)
  })
})
