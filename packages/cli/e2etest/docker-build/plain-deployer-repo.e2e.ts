import * as fs from "fs"
import { expect } from "chai"
import * as path from "path"

const shellExec = require('shell-exec')

describe("Build docker with kube.yaml deployment", function() {

  describe("build on master", function() {
    this.timeout(10000)
    let shepherdMeta, buildOutput
    let dockerMeta: any
    let queuedDeployment: any

    before(() => {
      process.env.SHEPHERD_DEPLOYMENT_QUEUE_FILE = process.cwd() + '/.build/deploymentq.jsonl'

      fs.writeFileSync(process.env.SHEPHERD_DEPLOYMENT_QUEUE_FILE, '')

      let dockerDir = path.join(__dirname, 'plain-deployer-repo')

      return shellExec(`./bin/shepherd-build-docker.sh ${dockerDir}/Dockerfile`,{env: {...process.env, ...{BRANCH_NAME:'master'}}}).then(
        ({ stdout, stderr }) => {
          if (stderr) expect.fail("GOT ERROR> " + stderr)
          shepherdMeta = require(dockerDir + '/.build/metadata/shepherd.json')
          buildOutput = stdout

          return shellExec(
            "docker inspect mylocalregistry:5000/plain-deployer-repo:latest"
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
      expect(queuedDeployment.dockerImageUrl).to.match(/mylocalregistry:5000\/plain-deployer-repo:[a-z1-9]*/)
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

  describe("build on a branch", function() {
    this.timeout(10000)
    let shepherdMeta, buildOutput
    let dockerMeta: any
    let queuedDeploymentFileContents: string

    before(() => {
      let dockerDir = path.join(__dirname, 'plain-deployer-repo')
      if(!fs.existsSync(process.cwd() + '/.build')){
        fs.mkdirSync(process.cwd() + '/.build')
      }
      process.env.SHEPHERD_DEPLOYMENT_QUEUE_FILE = process.cwd() + '/.build/deploymentq.jsonl'

      fs.writeFileSync(process.env.SHEPHERD_DEPLOYMENT_QUEUE_FILE, '')

      return shellExec(`./bin/shepherd-build-docker.sh ${dockerDir}/Dockerfile --dryrun`,{env: {...process.env, ...{BRANCH_NAME:'specBranch99', BUILD_NUMBER:'specBranch99'}}}).then(
        ({ stdout, stderr }) => {
          if (stderr) expect.fail("GOT ERROR> " + stderr)
          shepherdMeta = require(dockerDir + '/.build/metadata/shepherd.json')
          buildOutput = stdout

          return shellExec(
            "docker inspect plain-deployer-repo:latest"
          ).then(({ stdout }) => {
            dockerMeta = JSON.parse(stdout)
            queuedDeploymentFileContents = fs.readFileSync(process.env.SHEPHERD_DEPLOYMENT_QUEUE_FILE as string, "utf-8")
          })
        }
      )
    })


    it("should log info about missing branch deployment environment targets", () => {
      expect(buildOutput).to.contain("No deployment environments targeted for plain-deployer-repo, not queuing for deployment")
    })

    it("should not queue anything", () => {
      expect(queuedDeploymentFileContents).to.equal('')
    })


    xit("should suppress tslint warnings", () => {
      console.info(shepherdMeta)
      console.info(buildOutput)
      console.info(dockerMeta)
    })


  })

})


