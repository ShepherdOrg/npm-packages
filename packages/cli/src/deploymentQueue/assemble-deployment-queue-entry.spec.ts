import { assembleDeploymentQueueEntry } from "./assemble-deployment-queue-entry"
import * as path from "path"
import * as fs from "fs"
import { expect } from "chai"

describe("assembling deployment queue entry", function() {
  function readJsonFile(path: string) {
    return JSON.parse(fs.readFileSync(path, "utf8"))
  }

  describe("branch deploy", () => {
    let queueEntry: any

    before(() => {
      queueEntry = assembleDeploymentQueueEntry(
        readJsonFile(path.join(__dirname, "testdata", "branchdeploy", "shepherd.json")),
        path.join(__dirname, "testdata", "branchdeploy", "deploy.json"),
        "testBranchOne",
        98,
        true
      )
    })

    it("should use branch deploy environments", () => {
      expect(queueEntry.environments.length).to.equal(1)
    })

    it("should use branch deploy environments", () => {
      expect(queueEntry.dockerImageUrl).to.equal("docker/image:branch-url")
    })
  })

  describe("master deploy", function() {
    let queueEntry: any

    before(() => {
      queueEntry = assembleDeploymentQueueEntry(
        readJsonFile(path.join(__dirname, "testdata", "masterdeploy", "shepherd.json")),
        path.join(__dirname, "testdata", "masterdeploy", "deploy.json"),
        "master",
        98,
        false
      )
    })

    it("should use master deploy environments", () => {
      expect(queueEntry.environments.length).to.equal(2)
    })

    it("should remove branchDeployToEnvironments", () => {
      expect(queueEntry.branchDeployToEnvironments).to.equal(undefined)
    })

    it("should use image url from shepherd.json", () => {
      expect(queueEntry.dockerImageUrl).to.equal("docker/image:master-url")
    })
  })

  describe("branch deploy without target environments", function() {
    let queueEntry: any

    before(() => {
      queueEntry = assembleDeploymentQueueEntry(
        path.join(__dirname, "testdata", "missingBranchEnv", "shepherd.json"),
        path.join(__dirname, "testdata", "missingBranchEnv", "deploy.json"),
        "thisBranchWillNotDeploy",
        98,
        true
      )
    })

    it("should use empty environments list", () => {
      expect(queueEntry.environments.length).to.equal(0)
    })
  })
})
