import { strict as assert } from "node:assert"
import { describe, it, before, beforeEach } from "node:test"
import {
  asBashExports,
  extractVersionFromPackageJson,
  extractVersionFromVersionTxt,
  gitDirHash,
  preferredName,
  preferredVersion,
  TDirVersion,
  toVersionistJson,
  TVersionistVersion,
  versionInfo,
} from "./index"
import * as path from "path"

describe("Preferred semantic version", function() {
  let versionTxtContents: string
  let packageJsonContents: string

  let versionTxtVersion: string
  let packageVersion: string | undefined

  before(() => {
    versionTxtContents = ""
    packageJsonContents = ""
  })

  beforeEach(() => {
    versionTxtVersion = extractVersionFromVersionTxt(versionTxtContents)
    packageVersion = extractVersionFromPackageJson(packageJsonContents)
  })

  describe("using version txt", function() {
    before(() => {
      versionTxtContents = "99.9\n"
    })

    it("should use trimmed text contents for semantic version", () => {
      assert.strictEqual(versionTxtVersion, "99.9")
    })
  })

  describe("using package.json", function() {
    describe("empty or not present", function() {
      before(() => {
        packageJsonContents = ""
      })

      it("should return undefined semantic version", () => {
        assert.strictEqual(packageVersion, undefined)
      })
    })

    describe("with version field", function() {
      before(() => {
        packageJsonContents = `{ "version": "42.4.5", "name":"mrTest" }`
      })

      it("should use version field", () => {
        assert.strictEqual(packageVersion, "42.4.5")
      })
    })
  })
})

describe("full directory version info for versionist", function() {
  it("should extract full version info for self", async () => {
    let dirname = process.cwd()
    const dirVersion = await versionInfo(dirname)
    assert.strictEqual(dirVersion.packageJsonVersion, require("../package.json").version)
    assert.strictEqual(dirVersion.dirName, "versionist")
    assert.strictEqual(dirVersion.packageJsonName, "@shepherdorg/versionist")
    assert.strictEqual(preferredName(dirVersion), "versionist")
    assert.strictEqual(dirVersion.dockerRepositoryName, undefined)
  })

  describe("shepherd annotated repo", function() {
    it("should extract full version info for deployer repo", async () => {
      const dirVersion = await versionInfo(path.join(__dirname, "testdata", "shepherd-annotated"))
      assert.strictEqual(dirVersion.packageJsonName, undefined)
      assert.strictEqual(dirVersion.packageJsonVersion, undefined)
      assert.strictEqual(dirVersion.dirName, "shepherd-annotated")
      assert.strictEqual(preferredName(dirVersion), "plain-deployer-image")
      assert.strictEqual(preferredVersion(dirVersion), "0.1")
      assert.strictEqual(dirVersion.dockerRepositoryName, "plain-deployer-image")
      assert.strictEqual(dirVersion.dockerRegistryOrganization, "myorgone")
      assert.strictEqual(dirVersion.dockerRegistry, undefined)
      assert.strictEqual(dirVersion.txtVersion, "0.1")
    })
  })

  describe("export versionist JSON format", function() {
    it("should be correct", async () => {
      const dirVersion = await versionInfo(path.join(__dirname, "testdata", "shepherd-annotated"))

      assert.deepStrictEqual(toVersionistJson(dirVersion), {
        semanticVersion: "0.1",
        artifactName: "plain-deployer-image",
        artifactHash: "c881392e04dd98f9bd5692cc144bd9bdd5726c3d",
        dockerRepositoryName: "plain-deployer-image",
        dockerRegistryOrganization: "myorgone",
        dockerRegistry: undefined,
        branchName: undefined,
      })
    })
  })

  describe("with dockerOrganisation as parameter", function() {
    let dirVersion: TDirVersion

    before(async () => {
      dirVersion = await versionInfo(path.join(__dirname, "testdata", "not-annotated"), {
        dockerOrganization: "fakeOrgOne",
      })
    })

    it("should use provided organisation", async () => {
      assert.strictEqual(dirVersion.dockerRegistryOrganization, "fakeOrgOne")
    })
  })
})

describe("output as bash exports", function() {
  const dirVersion: TDirVersion = {
    dirHash: "c881392e04dd98f9bd5692cc144bd9bdd5726c3d",
    dirName: "shepherd-annotated",
    packageJsonName: undefined,
    packageJsonVersion: undefined,
    txtVersion: "0.1",
    dockerRepositoryName: "plain-deployer-image",
    dockerRegistryOrganization: "myorgone",
    dockerRegistry: "myregistry.local",
    branchName: "unittest",
  }

  describe("all information available", function() {
    let bashExports: string
    before(() => {
      bashExports = asBashExports(dirVersion)
    })

    it("should generate full version strings", async () => {
      assert.strictEqual(bashExports, "export IMAGE_URL=myregistry.local/myorgone/plain-deployer-image\n" +
          "export DOCKER_IMAGE=myregistry.local/myorgone/plain-deployer-image:0.1\n" +
          "export DOCKER_IMAGE_LATEST_TAG=myregistry.local/myorgone/plain-deployer-image:latest\n" +
          "export DOCKER_IMAGE_GITHASH_TAG=myregistry.local/myorgone/plain-deployer-image:c881392e04dd98f9bd5692cc144bd9bdd5726c3d\n" +
          "export DOCKER_IMAGE_BRANCH_HASH_TAG=myregistry.local/myorgone/plain-deployer-image:unittest-c881392e04dd98f9bd5692cc144bd9bdd5726c3d\n")
    })
  })

  describe("without registry info", function() {
    let bashExports: string
    before(() => {
      bashExports = asBashExports({ ...dirVersion, dockerRegistry: undefined })
    })

    it("should skip registry host", () => {
      assert.strictEqual(bashExports, "export IMAGE_URL=myorgone/plain-deployer-image\n" +
          "export DOCKER_IMAGE=myorgone/plain-deployer-image:0.1\n" +
          "export DOCKER_IMAGE_LATEST_TAG=myorgone/plain-deployer-image:latest\n" +
          "export DOCKER_IMAGE_GITHASH_TAG=myorgone/plain-deployer-image:c881392e04dd98f9bd5692cc144bd9bdd5726c3d\n" +
          "export DOCKER_IMAGE_BRANCH_HASH_TAG=myorgone/plain-deployer-image:unittest-c881392e04dd98f9bd5692cc144bd9bdd5726c3d\n")
    })
  })

  describe("without docker organisation", function() {
    let bashExports: string
    before(() => {
      bashExports = asBashExports({ ...dirVersion, dockerRegistryOrganization: "" })
    })

    it("should skip registry organisation", () => {
      assert.strictEqual(bashExports, "export IMAGE_URL=myregistry.local/plain-deployer-image\n" +
          "export DOCKER_IMAGE=myregistry.local/plain-deployer-image:0.1\n" +
          "export DOCKER_IMAGE_LATEST_TAG=myregistry.local/plain-deployer-image:latest\n" +
          "export DOCKER_IMAGE_GITHASH_TAG=myregistry.local/plain-deployer-image:c881392e04dd98f9bd5692cc144bd9bdd5726c3d\n" +
          "export DOCKER_IMAGE_BRANCH_HASH_TAG=myregistry.local/plain-deployer-image:unittest-c881392e04dd98f9bd5692cc144bd9bdd5726c3d\n")
    })
  })

  describe("with docker organisation from parameter", function() {
    let bashExports: string
    before(() => {
      bashExports = asBashExports({
        ...dirVersion,
        dockerRegistryOrganization: "someOrg",
        dockerRegistry: "private.reg",
      })
    })

    it("should include registry organisation", () => {
      assert.strictEqual(bashExports, "export IMAGE_URL=private.reg/someOrg/plain-deployer-image\n" +
          "export DOCKER_IMAGE=private.reg/someOrg/plain-deployer-image:0.1\n" +
          "export DOCKER_IMAGE_LATEST_TAG=private.reg/someOrg/plain-deployer-image:latest\n" +
          "export DOCKER_IMAGE_GITHASH_TAG=private.reg/someOrg/plain-deployer-image:c881392e04dd98f9bd5692cc144bd9bdd5726c3d\n" +
          "export DOCKER_IMAGE_BRANCH_HASH_TAG=private.reg/someOrg/plain-deployer-image:unittest-c881392e04dd98f9bd5692cc144bd9bdd5726c3d\n")
    })
  })

  describe("bug", function() {
    let dirInfo: TDirVersion = {
      dirHash: "e0a673d6752e16f1179c0654ba1c53e825d57bc6",
      dirName: "public-repo-with-kube-yaml",
      dockerRegistry: "",
      branchName: "fakebranch",
    }
    let bashExports: string

    before(() => {
      bashExports = asBashExports(dirInfo)
    })

    it("should be according to design", () => {
      assert.strictEqual(bashExports, `export IMAGE_URL=public-repo-with-kube-yaml
export DOCKER_IMAGE=public-repo-with-kube-yaml:0.0.0
export DOCKER_IMAGE_LATEST_TAG=public-repo-with-kube-yaml:latest
export DOCKER_IMAGE_GITHASH_TAG=public-repo-with-kube-yaml:e0a673d6752e16f1179c0654ba1c53e825d57bc6
export DOCKER_IMAGE_BRANCH_HASH_TAG=public-repo-with-kube-yaml:fakebranch-e0a673d6752e16f1179c0654ba1c53e825d57bc6
`)
    })
  })

  describe("explicit semantic version", function() {
    let dirInfo: TDirVersion = {
      dirHash: "e0a673d6752e16f1179c0654ba1c53e825d57bc6",
      dirName: "public-repo-with-kube-yaml",
      semanticVersion: "1.2.3",
    }
    let bashExports: string

    before(() => {
      bashExports = asBashExports(dirInfo)
    })

    it("should be according to design", () => {
      assert.strictEqual(bashExports, `export IMAGE_URL=public-repo-with-kube-yaml
export DOCKER_IMAGE=public-repo-with-kube-yaml:1.2.3
export DOCKER_IMAGE_LATEST_TAG=public-repo-with-kube-yaml:latest
export DOCKER_IMAGE_GITHASH_TAG=public-repo-with-kube-yaml:e0a673d6752e16f1179c0654ba1c53e825d57bc6
export DOCKER_IMAGE_BRANCH_HASH_TAG=public-repo-with-kube-yaml:e0a673d6752e16f1179c0654ba1c53e825d57bc6
`)
    })
  })

  describe.skip("Semantic version prioritization", function() {
    describe("when parameter is preferred", function() {
      let dirInfo: TDirVersion = {
        dirHash: "e0a673d6752e16f1179c0654ba1c53e825d57bc6",
        dirName: "public-repo-with-kube-yaml",
        semanticVersion: "1.2.3",
        txtVersion: "3.2.1",
      }
      let bashExports: string

      before(() => {
        bashExports = asBashExports(dirInfo)
      })

      it("should use parameter version", () => {
        assert.strictEqual(bashExports, `something else`)
      })
    })
  })
})

describe("Git dir hash", function() {
  let dirHash: any

  describe("for current directory", function() {
    before(async () => {
      dirHash = await gitDirHash(process.cwd())
    })

    it("should be a hash", () => {
      assert.strictEqual(dirHash.length, "b89e57d488a04de2ddfd9a43620b59e6b28ec98c".length)
    })
  })

  describe("No files in git", function() {
    before(async () => {
      dirHash = await gitDirHash(path.join("/tmp"))
    })

    it("should return empty string as hash", () => {
      assert.strictEqual(dirHash, "")
    })
  })
})
