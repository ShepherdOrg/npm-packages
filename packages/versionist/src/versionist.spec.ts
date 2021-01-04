import { expect } from "chai"
import {
  asBashExports,
  extractVersionFromPackageJson,
  extractVersionFromVersionTxt, gitDirHash,
  preferredName,
  preferredVersion,
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
      expect(versionTxtVersion).to.equal("99.9")
    })
  })


  describe("using package.json", function() {

    describe("empty or not present", function() {
      before(() => {
        packageJsonContents = ""
      })

      it("should return undefined semantic version", () => {
        expect(packageVersion).to.equal(undefined)
      })
    })

    describe("with version field", function() {
      before(() => {
        packageJsonContents = `{ "version": "42.4.5", "name":"mrTest" }`
      })

      it("should use version field", () => {
        expect(packageVersion).to.equal("42.4.5")
      })

    })

  })
})

describe("full directory version info for versionist", function() {

  it("should extract full version info", async () => {
    let dirname = process.cwd()
    const dirVersion = await versionInfo(dirname)
    expect(dirVersion.packageJsonVersion).to.equal("4.3.2")
    expect(dirVersion.dirName).to.equal("versionist")
    expect(dirVersion.packageJsonName).to.equal("@shepherdorg/versionist")
    expect(preferredName(dirVersion)).to.equal("versionist")
    expect(dirVersion.dockerRepositoryName).to.equal(undefined)
  })

  describe("shepherd annotated repo", function() {

    it("should extract full version info for deployer repo", async () => {
      const dirVersion = await versionInfo(path.join(__dirname, 'testdata', 'shepherd-annotated'))
      expect(dirVersion.packageJsonName).to.equal(undefined)
      expect(dirVersion.packageJsonVersion).to.equal(undefined)
      expect(dirVersion.dirName).to.equal("shepherd-annotated")
      expect(preferredName(dirVersion)).to.equal("plain-deployer-image")
      expect(preferredVersion(dirVersion)).to.equal("0.1")
      expect(dirVersion.dockerRepositoryName).to.equal("plain-deployer-image")
      expect(dirVersion.dockerRegistryOrganization).to.equal("myorgone")
      expect(dirVersion.dockerRegistry).to.equal(undefined)
      expect(dirVersion.txtVersion).to.equal("0.1")
    })
  })
})


describe("output as bash exports", function() {

  it("should generate bash export strings", async () => {

    const expected = 'export IMAGE_URL=myregistry.local/myorgone/plain-deployer-image\n' +
      'export DOCKER_IMAGE=myregistry.local/myorgone/plain-deployer-image:0.1\n' +
      'export DOCKER_IMAGE_LATEST_TAG=myregistry.local/myorgone/plain-deployer-image:latest\n' +
      'export DOCKER_IMAGE_GITHASH_TAG=myregistry.local/myorgone/plain-deployer-image:ed654be658cfa80b437ae6e2e23e8d80dca65a63\n' +
      'export DOCKER_IMAGE_BRANCH_HASH_TAG=myregistry.local/myorgone/plain-deployer-image:unittest-ed654be658cfa80b437ae6e2e23e8d80dca65a63\n'

    const dirVersion = await versionInfo(path.join(__dirname, 'testdata', 'shepherd-annotated'), {dockerRegistry: 'myregistry.local', branchName: 'unittest'})

    const bashExports = asBashExports(dirVersion )

    expect(bashExports).to.equal(expected)

  })

})


describe("Git dir hash", function() {
  let dirHash: any


  describe("for current directory", function() {
    before(async () => {
      dirHash = await gitDirHash(process.cwd())
    })

    it("should be a hash", () => {
      expect(dirHash.length).to.equal("b89e57d488a04de2ddfd9a43620b59e6b28ec98c".length)
    })
  })


  describe("No files in git", function() {
    before(async () => {
      dirHash = await gitDirHash(path.join(process.cwd(), "node_modules"))
    })

    it("should return empty string as hash", () => {
      expect(dirHash).to.equal("")
    })

  })

})
