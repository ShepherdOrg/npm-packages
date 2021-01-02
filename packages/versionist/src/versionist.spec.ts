import { expect } from "chai"
import * as path from "path"

// Create a domain lingo for versionist, or use docker lingo? Docker image naming and

export interface TSemanticVersion {
  semanticVersion: string | undefined
}

function extractVersionUsingDockerFromLine(fromLine: string): TSemanticVersion {
  const fromLineBreakdown = fromLine.match(/.*FROM\s+([/\w0-9\-]{1,127}):?([,\w0-9\-.]{0,127})(^|\s)*.*/)

  if (fromLineBreakdown) {
    return {
      semanticVersion: fromLineBreakdown[2],
    }
  } else {
    throw new Error(`Error parsing docker FROM line, no match found for docker repository in ${fromLine}`)
  }
}

function extractVersionFromDockerfile(dockerFileContents: string): TSemanticVersion {
  let strings = dockerFileContents.split("\n")
  const fromLine = strings.find((line) => line.match(/.*FROM.*/))
  if (fromLine) {
    return extractVersionUsingDockerFromLine(fromLine)
  } else {
    throw new Error(`This does not look like a valid docker file, no line with FROM keyword found.\n${dockerFileContents}`)
  }
}

function extractVersionFromVersionTxt(versionTxtContents: string): TSemanticVersion {
  return { semanticVersion: versionTxtContents && versionTxtContents.trim() || "" }
}

function extractVersionFromPackageJson(packageJsonContents: string): TSemanticVersion {
  if (!packageJsonContents) {
    return {
      semanticVersion: undefined,
    }
  }
  let packageJs = JSON.parse(packageJsonContents)
  return { semanticVersion: packageJs.version }
}

function extractPreferredVersion(versionTxtContents: string, packageJsonContents: string, dockerFileContents: string): TSemanticVersion {
  if (versionTxtContents) {
    let versionTxtVersion = extractVersionFromVersionTxt(versionTxtContents)
    if(versionTxtVersion.semanticVersion){
      return versionTxtVersion
    }
  } else if (packageJsonContents) {
    let packageVersion = extractVersionFromPackageJson(packageJsonContents)
    if (packageVersion.semanticVersion) {
      return packageVersion
    }
  } else if (dockerFileContents) {
    let fromImageVersion = extractVersionFromDockerfile(dockerFileContents)
    if(fromImageVersion.semanticVersion){
      return fromImageVersion
    }
  }
  return {
    semanticVersion: undefined,
  }
}

describe("Preferred semantic version", function() {
  let dockerFileContents: string
  let versionTxtContents: string
  let packageJsonContents: string

  let dockerFromImageVersion: TSemanticVersion
  let versionTxtVersion: TSemanticVersion
  let dockerFromPackageVersion: TSemanticVersion


  before(() => {
    versionTxtContents = ""
    packageJsonContents = ""
  })

  beforeEach(() => {
    dockerFromImageVersion = extractVersionFromDockerfile(dockerFileContents)
    versionTxtVersion = extractVersionFromVersionTxt(versionTxtContents)
    dockerFromPackageVersion = extractVersionFromPackageJson(packageJsonContents)
  })

  describe("Standalone dockerfile", function() {

    describe("plain FROM statement with tag on upstream image", function() {
      before(() => {
        dockerFileContents = `FROM alpine:8.3\nCOPY\t something\n`
      })

      it("should use version from upstream docker if present", () => {
        expect(dockerFromImageVersion.semanticVersion).to.equal("8.3")
      })
    })

    describe("plain FROM statement with latest as tag", function() {
      before(() => {
        dockerFileContents = `FROM alpine:latest\nCOPY\t something\n`
      })

      it("should return latest", () => {
        expect(dockerFromImageVersion.semanticVersion).to.equal("latest")
      })
    })

    describe("plain FROM statement with no tag on FROM image", function() {
      before(() => {
        dockerFileContents = `FROM alpine\nCOPY\t something\n`
      })


      it("should return empty string", () => {
        expect(dockerFromImageVersion.semanticVersion).to.equal("")
      })
    })

    describe("FROM statement with AS alias  ", function() {

      before(() => {
        dockerFileContents = `FROM myimage:8.4 as builder\nCOPY\t something\n`
      })


      it("should not be confused by the AS alias", () => {
        expect(dockerFromImageVersion.semanticVersion).to.equal("8.4")
      })

    })
  })

  describe("using version txt", function() {
    before(() => {
      versionTxtContents = "99.9\n"
    })

    it("should use trimmed text contents for semantic version", () => {
      expect(versionTxtVersion.semanticVersion).to.equal("99.9")
    })
  })


  describe("using package.json", function() {

    describe("empty or not present", function() {
      before(() => {
        packageJsonContents = ""
      })

      it("should return undefined semantic version", () => {
        expect(dockerFromPackageVersion.semanticVersion).to.equal(undefined)
      })
    })

    describe("with version field", function() {
      before(() => {
        packageJsonContents = `{ "version": "42.4.5", "name":"mrTest" }`
      })

      it("should use version field", () => {
        expect(dockerFromPackageVersion.semanticVersion).to.equal("42.4.5")
      })

      it("should use name field for naming docker repository (image name)", () => {
        expect(dockerFromImageVersion.semanticVersion)
      })

    })

  })

  describe("heuristic", function() {

    let preferredVersion: TSemanticVersion

    beforeEach(() => {
      preferredVersion = extractPreferredVersion(versionTxtContents, packageJsonContents, dockerFileContents)
    })

    describe("only dockerfile from", function() {

      before(() => {
        dockerFileContents = `FROM myimage:8.4 as builder\nCOPY\t something\n`
        packageJsonContents = ``
        versionTxtContents = ""
      })

      it("should prefer package.json over dockerfile FROM", () => {
        expect(preferredVersion.semanticVersion).to.equal("8.4")
      })
    })

    describe("package.json and dockerfile from", function() {

      before(() => {
        dockerFileContents = `FROM myimage:8.4 as builder\nCOPY\t something\n`
        packageJsonContents = `{ "version": "48.4.5", "name":"mrTest" }`
        versionTxtContents = ""
      })

      it("should prefer package.json over dockerfile FROM", () => {
        expect(preferredVersion.semanticVersion).to.equal("48.4.5")
      })
    })

    describe("version.txt and package.json", function() {

      before(() => {
        dockerFileContents = `FROM myimage:8.4 as builder\nCOPY\t something\n`
        packageJsonContents = `{ "version": "48.4.5", "name":"mrTest" }`
        versionTxtContents = "99.9"
      })

      it("should prefer version.txt over package json", () => {
        expect(preferredVersion.semanticVersion).to.equal("99.9")
      })
    })

    describe("No usable semantic version present", function() {

      before(() => {
        dockerFileContents = "FROM alpine"
        packageJsonContents = ""
        versionTxtContents = ""
      })

      it("should return undefined for semantic version", () => {
        expect(preferredVersion.semanticVersion).to.equal(undefined)

      })
    })
  })
})


const shellExec = require('shell-exec')

async function gitDirHash(dirname: string) {
  const GIT_DIR_HASH_CMD = "git ls-files -s . | git hash-object --stdin"
  const EMPTY_DIR_HASH='e69de29bb2d1d6434b8b29ae775ad8c2e48c5391'

  const dirHash = await shellExec(GIT_DIR_HASH_CMD, { cwd: dirname, env: { ...process.env, ...{ BRANCH_NAME: "master" } } }).then(
    ({ stdout, stderr,code }) => {
      if (code !== 0) throw new Error(`Process exited with code ${code} while calculating dir hash. \n${stdout}\n ${stderr}\n` )
      let hash = stdout.trim()
      if(hash === EMPTY_DIR_HASH){
        return ""
      }
      return hash
    },
  )
  return dirHash
}

describe("Git dir hash", function() {
  let dirHash: any


  describe("for current directory", function() {
    before(async ()=>{
      dirHash = await gitDirHash(process.cwd())
    })

    it("should be a hash", () => {
      expect(dirHash.length).to.equal('b89e57d488a04de2ddfd9a43620b59e6b28ec98c'.length)
    })
  })


  describe.only("No files in git", function() {
    before(async ()=>{
      dirHash = await gitDirHash(path.join(process.cwd(), 'node_modules'))
    })

    it("should return empty string as hash", () => {
      expect(dirHash).to.equal('')
    })

  })

  describe("With .dockerignore file present (or other mechanism to exclude files from hash generation)", function() {

    it("should exclude files from hash", () => {
      expect.fail("IMPLEMENT")

    })
  })

})
