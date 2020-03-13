import { expect } from "chai"
import { exec } from "child-process-promise"
import * as fs from "fs"

describe("Build docker with kube.yaml deployment", function() {
  this.timeout(10000)
  let shepherdMeta, buildOutput
  let dockerMeta: any

  before(() => {
    let dockerDir = __dirname
    return exec(`./bin/shepherd-build-docker.sh ${dockerDir}/Dockerfile`).then(
      ({ stdout, stderr }) => {
        if (stderr) expect.fail("GOT ERROR> " + stderr)

        shepherdMeta = JSON.parse(fs.readFileSync(__dirname + '/.build/metadata/shepherd.json', 'utf8'))
        buildOutput = stdout

        return exec(
          "docker inspect public-repo-with-kube-yaml:latest"
        ).then(({ stdout }) => {
          dockerMeta = JSON.parse(stdout)
        })
      }
    )
  })

  function base64decode(encoded: string){
    return Buffer.from(encoded, "base64").toString('utf8')
  }

  it("should have kubeConfigB64", () => {
    expect((shepherdMeta.kubeConfigB64.length)).to.be.gt(500)
  })

  it("should have last 5 commits base64 encoded", () => {
    expect(base64decode(shepherdMeta.lastCommits)).to.be.contain('by')
  })

  xit("should suppress tslint warnings", () => {
    console.info(shepherdMeta)
    console.info(buildOutput)
    console.info(dockerMeta)
  })
})
