import { strict as assert } from "node:assert"
import { describe, it, before } from "node:test"
import * as fs from "fs"
import * as path from "path"
import { execCmd } from "../../src/exec/exec-cmd"
import { getDockerTags } from "./get-docker.tags"

describe("Build docker with kube.yaml deployment on branch (Flaky test, succeeds alone, fails with others. Some race condidions or interaction in place)", function() {
  let shepherdMeta, buildOutput
  let dockerMeta: any

  let testImageName = "public-repo-with-kube-yaml"
  let dockerDir = path.join(__dirname, testImageName)

  before(async () => {
    try {
      const existingTags = await getDockerTags(testImageName)

      await Promise.all(
        existingTags.map(etag => {
          return execCmd("docker", ["rmi", etag])
        })
      )
    } catch (err) {
      // console.info(`No need to clean up ${testImageName}`)
    }

    return execCmd(`./bin/shepherd-build-docker.sh`, [`${dockerDir}/Dockerfile`, "--force-build", "--verbose"], {
      env: { ...process.env, ...{ BRANCH_NAME: "fakebranch" } },
    }).then(({ code, stdout, stderr }) => {
      if (code) assert.fail(`Exit with error code  ${code}\n${stderr}\n${stdout}`)

      shepherdMeta = JSON.parse(fs.readFileSync(dockerDir + "/.build/metadata/shepherd.json", "utf8"))
      buildOutput = stdout

      return execCmd("docker", ["inspect", "public-repo-with-kube-yaml:latest"]).then(({ stdout }) => {
        dockerMeta = JSON.parse(stdout)
      })
    })
  })

  function base64decode(encoded: string) {
    return Buffer.from(encoded, "base64").toString("utf8")
  }

  function findRepoTag(branchRepoTag: string) {
    return dockerMeta[0].RepoTags.find(rt => {
      return rt.match(branchRepoTag)
    })
  }

  it("should have kubeConfigB64", () => {
    assert.ok(shepherdMeta.kubeConfigB64.length > 500)
  })

  it("should have last 5 commits base64 encoded", () => {
    assert.ok(base64decode(shepherdMeta.lastCommits).includes("by"))
  })

  it("should have a branch tag", () => {
    assert.ok(findRepoTag("public-repo-with-kube-yaml:fakebranch-[a-z1-9]"))
  })

  it("should have a latest tag", () => {
    assert.ok(findRepoTag("public-repo-with-kube-yaml:latest"))
  })

  it("should have plain hash tag", () => {
    assert.ok(findRepoTag("public-repo-with-kube-yaml:[a-z1-9]"))
  })

  describe("build again on master", function() {
    let shepherdDeployFile = path.join("/tmp/", "test-public-repo-with-kube-yaml-deploy.jsonl")
    let masterStdout: string
    let queueEntry: any

    before(async () => {
      fs.closeSync(fs.openSync(shepherdDeployFile, "w"))
      return execCmd(`./bin/shepherd-build-docker.sh`, [`${dockerDir}/Dockerfile`, "push"], {
        env: {
          ...process.env,
          ...{ BRANCH_NAME: "master", SHEPHERD_DEPLOYMENT_QUEUE_FILE: shepherdDeployFile, FORCE_PUSH: "true" },
        },
      }).then(({ code, stdout, stderr }) => {
        if (code) assert.fail(`Exit with error code  ${code}\n${stderr}\n${stdout}`)

        masterStdout = stdout
        shepherdMeta = JSON.parse(fs.readFileSync(dockerDir + "/.build/metadata/shepherd.json", "utf8"))
        buildOutput = stdout

        return execCmd("docker", ["inspect", "public-repo-with-kube-yaml:latest"]).then(({ stdout }) => {
          queueEntry = JSON.parse(fs.readFileSync(shepherdDeployFile, "utf8"))
          dockerMeta = JSON.parse(stdout)
        })
      })
    })

    it("should have master tag", () => {
      assert.ok(findRepoTag("public-repo-with-kube-yaml:master-[a-z1-9]"))
    })

    it("should not build again, only tag", () => {
      assert.ok(masterStdout.indexOf("is already built, not building again") >= 0)
    })

    it("should add one entry to deployment Q", () => {
      assert.match(queueEntry.dockerImageUrl, /public-repo-with-kube-yaml:[a-z1-9]*/)
    })

    it("should have deployment key correct", () => {
      assert.strictEqual(queueEntry.deploymentKey, testImageName)
    })
  })

  it.skip("should suppress tslint warnings", () => {
    console.info(shepherdMeta)
    console.info(buildOutput)
    console.info(dockerMeta)
  })
})
