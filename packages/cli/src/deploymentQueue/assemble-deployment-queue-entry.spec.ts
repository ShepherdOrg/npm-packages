import { assembleDeploymentQueueEntry } from "./assemble-deployment-queue-entry"
import * as path from 'path'
import { expect } from "chai"

describe("assembling deployment queue entry", function() {

  describe('branch deploy', ()=>{
    let queueEntry: any

    before(()=>{
      queueEntry = assembleDeploymentQueueEntry(path.join(__dirname, "testdata", "branchdeploy", "shepherd.json"), path.join(__dirname, "testdata", "branchdeploy", "deploy.json"), "testBranchOne", 98)
    })

    it("should use branch deploy environments", () => {
      expect(queueEntry.environments.length).to.equal(1)
    })
  })

  describe("master deploy", function() {

    let queueEntry: any

    before(()=>{
      queueEntry = assembleDeploymentQueueEntry(path.join(__dirname, "testdata", "masterdeploy", "shepherd.json"), path.join(__dirname, "testdata", "masterdeploy", "deploy.json"), "master", 98)
    })

    it("should use master deploy environments", () => {
      expect(queueEntry.environments.length).to.equal(2)
    })

    it("should remove branchDeployToEnvironments", () => {
      expect(queueEntry.branchDeployToEnvironments).to.equal(undefined)
    })

  })

  describe("branch deploy without target environments", function() {

    let queueEntry: any

    before(()=>{
      queueEntry = assembleDeploymentQueueEntry(path.join(__dirname, "testdata", "missingBranchEnv", "shepherd.json"), path.join(__dirname, "testdata", "missingBranchEnv", "deploy.json"), "thisBranchWillNotDeploy", 98)
    })

    it("should use empty environments list", () => {
      expect(queueEntry.environments.length).to.equal(0)
    })

  })

})
