import { InMemoryStore } from "./in-memory-backend"
import { strict as assert } from "node:assert"
import { describe, it, before, beforeEach } from "node:test"

import { DeploymentDir, IReleaseStateStore, ReleaseStateStore } from "./state-store"
import { TDeploymentState } from "@shepherdorg/metadata"

describe("deployment dir", function() {
  it("should give an error if not a directory", function() {
    try {
      DeploymentDir("apply", __dirname + "/testdata/deployment1/monitors-namespace.yml")
      assert.fail("Error expected")
    } catch (e) {
      assert.strictEqual(e.message, __dirname + "/testdata/deployment1/monitors-namespace.yml is not a directory")
    }
  })

  it("should calculate signature for directory contents", function() {
    assert.strictEqual(DeploymentDir("apply", __dirname + "/testdata/deployment1").signature(), "676f174330907be1b69b114992a0e3df")
  })

  it("two dirs with identical contents should yield same signature", function() {
    assert.strictEqual(DeploymentDir("apply", __dirname + "/testdata/deployment1").signature(), DeploymentDir("apply", __dirname + "/testdata/deployment2").signature())
  })
})

describe("deployment state store", function() {
  describe("deployment descriptor storing", function() {
    let releaseStateStore: IReleaseStateStore
    let secondState: TDeploymentState
    let storageBackend

    describe("unmodified", function() {
      beforeEach(function(_t, done) {
        storageBackend = InMemoryStore()
        releaseStateStore = ReleaseStateStore({ storageBackend })

        releaseStateStore
          .getDeploymentState({
            operation: "apply",
            identifier: "deployment/identifier",
            version: "deployment.version",
            descriptor: "k8s yaml or env + parameters go here",
            env: "testrun",
            origin: "deployment-descriptor-storing-test",
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
                origin: "deployment-descriptor-storing-test",
              })
              .then(function(st2) {
                secondState = st2
                done()
              })
          })
      })

      it("second state should not report new", function() {
        assert.strictEqual(secondState.new, false)
      })

      it("second should not have state modified ", function() {
        assert.strictEqual(secondState.modified, false)
      })

      it("second state last version should be original version", function() {
        assert.strictEqual(secondState.lastVersion, "deployment.version")
      })
    })

    describe("handling defective deployment descriptor", function() {
      let caughtError: any
      function getOnDefectiveDeploymentDescriptor(descriptor: any) {
        caughtError = undefined
        storageBackend = InMemoryStore()
        releaseStateStore = ReleaseStateStore({ storageBackend })

        return releaseStateStore.getDeploymentState(descriptor).catch(err => {
          caughtError = err
        })
      }

      describe("missing env", function() {
        before(async () => {
          return getOnDefectiveDeploymentDescriptor({
            operation: "apply",
            identifier: "deployment/identifier",
            version: "deployment.version",
            descriptor: "k8s yaml or env + parameters go here",
            env: "",
            origin: "changed-descriptor-test",
          })
        })

        it("should warn me that env must be set", () => {
          assert.strictEqual(caughtError.message, "Env must be set and be longer than zero")
        })
      })

      describe("missing identifier", function() {
        before(async () => {
          return getOnDefectiveDeploymentDescriptor({
            operation: "apply",
            identifier: "",
            version: "deployment.version",
            descriptor: "k8s yaml or env + parameters go here",
            env: "testenv",
            origin: "changed-descriptor-test",
          })
        })

        it("should warn me that identifier must be set", () => {
          assert.strictEqual(caughtError.message, "Deployment identifier must be set and be longer than zero")
        })
      })
    })

    describe("changed deployment descriptor", function() {
      beforeEach(function(_t, done) {
        storageBackend = InMemoryStore()
        releaseStateStore = ReleaseStateStore({ storageBackend })

        releaseStateStore
          .getDeploymentState({
            operation: "apply",
            identifier: "deployment/identifier",
            version: "deployment.version",
            descriptor: "k8s yaml or env + parameters go here",
            env: "testrun",
            origin: "changed-descriptor-test",
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
                origin: "changed-descriptor-test",
              })
              .then(function(st2) {
                secondState = st2
                done()
              })
          })
      })

      it("second state should not report new", function() {
        assert.strictEqual(secondState.new, false)
      })

      it("second should have state modified ", function() {
        assert.strictEqual(secondState.modified, true)
      })

      it("second state last version should be original version", function() {
        assert.strictEqual(secondState.lastVersion, "deployment.version")
      })
    })

    describe("changed deployment version", function() {
      beforeEach(function(_t, done) {
        storageBackend = InMemoryStore()
        releaseStateStore = ReleaseStateStore({ storageBackend })

        releaseStateStore
          .getDeploymentState({
            operation: "apply",
            identifier: "deployment/identifier",
            version: "deployment.version",
            descriptor: "k8s yaml or env + parameters go here",
            env: "testrun",
            origin: "changed-descriptor-test",
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
                origin: "changed-descriptor-test",
              })
              .then(function(st2) {
                secondState = st2
                done()
              })
          })
      })

      it("second state should not report new", function() {
        assert.strictEqual(secondState.new, false)
      })

      it("second should have state modified ", function() {
        assert.strictEqual(secondState.modified, true)
      })

      it("second state last version should be original version", function() {
        assert.strictEqual(secondState.lastVersion, "deployment.version")
      })
    })
  })
})
