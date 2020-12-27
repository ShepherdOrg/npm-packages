import { expect } from "chai"
import * as fs from "fs"
import * as path from "path"
import { execCmd } from "../../src/exec/exec-cmd"
import { getDockerTags } from "./get-docker.tags"

describe("Build docker with kube.yaml deployment on branch (Flaky test, succeeds alone, fails with others. Some race condidions or interaction in place)", function() {
  this.timeout(10000)
  let shepherdMeta, buildOutput
  let dockerMeta: any

  let testImageName = 'public-repo-with-kube-yaml'
  let dockerDir = path.join(__dirname, testImageName)

  before(async () => {

    console.log(`DEBUG Cleaning up tags for ${testImageName}`)
    try{
      const existingTags = await getDockerTags(testImageName)

      await Promise.all(existingTags.map((etag)=>{
        return execCmd('docker', ['rmi', etag])
      }))

    }catch(err){
      console.info(`No need to clean up ${testImageName}`)
    }

    return execCmd(`./bin/shepherd-build-docker.sh`, [`${dockerDir}/Dockerfile`], { env: {...process.env, ...{'BRANCH_NAME':'fakebranch'} }}).then(
      ({ code, stdout, stderr }) => {
        if (code) expect.fail("GOT ERROR> " + stderr)

        // console.log(`DEBUG ${chalk.red(stderr)} \n, ${stdout}`)

        shepherdMeta = JSON.parse(fs.readFileSync(dockerDir + '/.build/metadata/shepherd.json', 'utf8'))
        buildOutput = stdout

        return execCmd("docker", ["inspect", "public-repo-with-kube-yaml:latest"]
        ).then(({ stdout }) => {
          dockerMeta = JSON.parse(stdout)
        })
      }
    )
  })

  function base64decode(encoded: string){
    return Buffer.from(encoded, "base64").toString('utf8')
  }

  function findRepoTag(branchRepoTag: string) {
    return dockerMeta[0].RepoTags.find((rt) => {
      return rt.match(branchRepoTag)
    })
  }

  it("should have kubeConfigB64", () => {
    expect((shepherdMeta.kubeConfigB64.length)).to.be.gt(500)
  })

  it("should have last 5 commits base64 encoded", () => {
    expect(base64decode(shepherdMeta.lastCommits)).to.be.contain('by')
  })

  it("should have a branch tag", () => {
    expect(findRepoTag('public-repo-with-kube-yaml:fakebranch-[a-z1-9]')).to.be.ok
  })

  it("should have a latest tag", () => {
    expect(findRepoTag('public-repo-with-kube-yaml:latest')).to.be.ok
  })

  it("should have plain hash tag", () => {
    expect(findRepoTag('public-repo-with-kube-yaml:[a-z1-9]')).to.be.ok
  })

  describe("build again on master", function() {

    let shepherdDeployFile = path.join('/tmp/','test-public-repo-with-kube-yaml-deploy.jsonl')
    let masterStdout: string
    let queueEntry: any

    before(async ()=>{

      fs.closeSync(fs.openSync(shepherdDeployFile, 'w'))
      return execCmd(`./bin/shepherd-build-docker.sh`, [`${dockerDir}/Dockerfile`, 'push'], { env: {...process.env, ...{'BRANCH_NAME':'master', 'SHEPHERD_DEPLOYMENT_QUEUE_FILE': shepherdDeployFile, 'FORCE_PUSH':"true"} }}).then(
        ({ code, stdout, stderr }) => {
          if (code) expect.fail("GOT ERROR> " + stderr)

          masterStdout = stdout
          shepherdMeta = JSON.parse(fs.readFileSync(dockerDir + '/.build/metadata/shepherd.json', 'utf8'))
          buildOutput = stdout

          return execCmd("docker", ["inspect", "public-repo-with-kube-yaml:latest"]
          ).then(({ stdout }) => {
            queueEntry = JSON.parse(fs.readFileSync(shepherdDeployFile, "utf8"))
            dockerMeta = JSON.parse(stdout)
          })
        }
      )
    })

    it("should have master tag", () => {
      expect(findRepoTag('public-repo-with-kube-yaml:master-[a-z1-9]')).to.be.ok
    })

    it("should not build again, only tag", () => {
      expect(masterStdout.indexOf('is already built, not building again')).to.be.gte(0)
    })

    it("should add one entry to deployment Q", () => {
      expect(queueEntry.dockerImageUrl).to.match(/public-repo-with-kube-yaml:[a-z1-9]*/)
    })

    it("should have deployment key correct", () => {
      expect(queueEntry.deploymentKey).to.equal(testImageName)
    })


  })


  xit("should suppress tslint warnings", () => {
    console.info(shepherdMeta)
    console.info(buildOutput)
    console.info(dockerMeta)
  })
})
