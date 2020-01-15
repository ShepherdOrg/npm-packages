import * as fs from "fs"
import { expect } from "chai"
import { exec } from "child-process-promise"

describe("Build docker with kube.yaml deployment", function() {
  this.timeout(10000)
  let shepherdMeta, buildOutput
  let dockerMeta: any
  let queuedDeployment: any

  before(() => {
    let dockerDir = __dirname
    if(!fs.existsSync(process.cwd() + '/.build')){
      fs.mkdirSync(process.cwd() + '/.build')
    }
    process.env.SHEPHERD_DEPLOYMENT_QUEUE_FILE = process.cwd() + '/.build/deploymentq.jsonl'

    fs.writeFileSync(process.env.SHEPHERD_DEPLOYMENT_QUEUE_FILE, '')
    // fs.closeSync(fs.openSync(process.env.SHEPHERD_DEPLOYMENT_QUEUE_FILE as string, 'a'));
    return exec(`./bin/shepherd-build-docker.sh ${dockerDir}/Dockerfile --dryrun`).then(
      ({ stdout, stderr }) => {
        if (stderr) expect.fail("GOT ERROR> " + stderr)
        shepherdMeta = require(__dirname + '/.build/metadata/shepherd.json')
        buildOutput = stdout

        return exec(
          "docker inspect plain-deployer-repo:latest"
        ).then(({ stdout }) => {
          dockerMeta = JSON.parse(stdout)
          queuedDeployment = JSON.parse(fs.readFileSync(process.env.SHEPHERD_DEPLOYMENT_QUEUE_FILE as string, "utf-8"))
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

  it("should append to deploymentq.jsonl", () => {
    expect(queuedDeployment.semanticVersion).not.to.equal('latest')
  })

  it("should have correct deploymentKey", () => {
    expect(queuedDeployment.deploymentKey).to.equal('plain-deployer-repo')
  })

  it("should have correct dockerImageTag", () => {
    expect(queuedDeployment.dockerImageTag).to.contain('mylocalregistry:5000/plain-deployer-repo:0.1-')
  })

  it("should log adding to deployment queue", () => {
    expect(buildOutput).to.contain("Queueing deployment of mylocalregistry:5000/plain-deployer-repo")
  })

  xit("should suppress tslint warnings", () => {
    console.info(shepherdMeta)
    console.info(buildOutput)
    console.info(dockerMeta)
  })
})
