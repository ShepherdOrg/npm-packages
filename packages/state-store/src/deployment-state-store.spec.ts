import { InMemoryStore } from "./in-memory-backend"
import { expect } from "chai"

import { DeploymentDir, IReleaseStateStore, ReleaseStateStore } from "./state-store"
import { TDeploymentState } from "@shepherdorg/metadata"

describe("deployment dir", function() {
  it("should give an error if not a directory", function() {
    try {
      DeploymentDir(
        "apply",
        __dirname + "/testdata/deployment1/monitors-namespace.yml"
      )
      expect.fail("Error expected")
    } catch (e) {
      expect(e.message).to.equal(
        __dirname +
          "/testdata/deployment1/monitors-namespace.yml is not a directory"
      )
    }
  })

  it("should calculate signature for directory contents", function() {
    expect(
      DeploymentDir("apply", __dirname + "/testdata/deployment1").signature()
    ).to.equal("676f174330907be1b69b114992a0e3df")
  })

  it("two dirs with identical contents should yield same signature", function() {
    expect(
      DeploymentDir("apply", __dirname + "/testdata/deployment1").signature()
    ).to.equal(
      DeploymentDir("apply", __dirname + "/testdata/deployment2").signature()
    )
  })
})

describe("deployment state store", function() {


  describe("deployment descriptor storing", function() {
    let releaseStateStore : IReleaseStateStore
    let secondState : TDeploymentState
    let storageBackend

    describe("unmodified", function() {
      beforeEach(function(done) {
        storageBackend = InMemoryStore()
        releaseStateStore = ReleaseStateStore({ storageBackend })

        releaseStateStore
          .getDeploymentState({
            operation: "apply",
            identifier: "deployment/identifier",
            version: "deployment.version",
            descriptor: "k8s yaml or env + parameters go here",
            env: "testrun",
            origin: 'deployment-descriptor-storing-test'
          })
          .then(releaseStateStore.saveDeploymentState)
          .then(function(_st1) {
            // console.debug("_st1", _st1);
            // firstState = _st1;
            releaseStateStore
              .getDeploymentState({
                operation: "apply",
                identifier: "deployment/identifier",
                version: "deployment.version",
                descriptor: "k8s yaml or env + parameters go here",
                env: "testrun",
                origin: 'deployment-descriptor-storing-test'
              })
              .then(function(st2) {
                secondState = st2
                done()
              })
          })
      })

      it("second state should not report new", function() {
        expect(secondState.new).to.equal(false)
      })

      it("second should not have state modified ", function() {
        expect(secondState.modified).to.equal(false)
      })

      it("second state last version should be original version", function() {
        expect(secondState.lastVersion).to.equal("deployment.version")
      })
    })

    describe("changed deployment descriptor", function() {
      beforeEach(function(done) {
        storageBackend = InMemoryStore()
        releaseStateStore = ReleaseStateStore({ storageBackend })

        releaseStateStore
          .getDeploymentState({
            operation: "apply",
            identifier: "deployment/identifier",
            version: "deployment.version",
            descriptor: "k8s yaml or env + parameters go here",
            env: "testrun",
            origin: 'changed-descriptor-test'
          })
          .then(releaseStateStore.saveDeploymentState)
          .then(function(_st1) {
            // firstState = st1;
            releaseStateStore
              .getDeploymentState({
                operation: "apply",
                identifier: "deployment/identifier",
                version: "deployment.version",
                descriptor: "changed k8s yaml or env + parameters go here",
                env: "testrun",
                origin: 'changed-descriptor-test'
              })
              .then(function(st2) {
                secondState = st2
                done()
              })
          })
      })

      it("second state should not report new", function() {
        expect(secondState.new).to.equal(false)
      })

      it("second should have state modified ", function() {
        expect(secondState.modified).to.equal(true)
      })

      it("second state last version should be original version", function() {
        expect(secondState.lastVersion).to.equal("deployment.version")
      })
    })

    describe("changed deployment version", function() {
      beforeEach(function(done) {
        storageBackend = InMemoryStore()
        releaseStateStore = ReleaseStateStore({ storageBackend })

        releaseStateStore
          .getDeploymentState({
            operation: "apply",
            identifier: "deployment/identifier",
            version: "deployment.version",
            descriptor: "k8s yaml or env + parameters go here",
            env: "testrun",
            origin: 'changed-descriptor-test'
          })
          .then(releaseStateStore.saveDeploymentState)
          .then(function(_st1) {
            // firstState = st1;
            releaseStateStore
              .getDeploymentState({
                operation: "apply",
                identifier: "deployment/identifier",
                version: "deployment.new.version",
                descriptor: "k8s yaml or env + parameters go here",
                env: "testrun",
                origin: 'changed-descriptor-test'
              })
              .then(function(st2) {
                secondState = st2
                done()
              })
          })
      })

      it("second state should not report new", function() {
        expect(secondState.new).to.equal(false)
      })

      it("second should have state modified ", function() {
        expect(secondState.modified).to.equal(true)
      })

      it("second state last version should be original version", function() {
        expect(secondState.lastVersion).to.equal("deployment.version")
      })
    })
  })
})
