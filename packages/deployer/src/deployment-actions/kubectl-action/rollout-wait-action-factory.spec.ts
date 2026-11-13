import { strict as assert } from "node:assert"
import { describe, it, before } from "node:test"
import { createRolloutWaitActionFactory } from "./rollout-wait-action-factory"

import { createFakeStateStore, TFakeStateStore } from "@shepherdorg/state-store/dist/fake-state-store-factory"
import { createFakeLogger, IFakeLogging } from "@shepherdorg/logger"
import { IStatefulExecutableAction, TActionExecutionOptions } from "../../deployment-types"
import { defaultTestExecutionOptions } from "../../test-tools/test-action-execution-options"
import { Oops } from "oops-error"
import { initFakeExecution, IFakeExecution } from "@shepherdorg/ts-exec"

describe("K8S deployment rollout status wait action factory", function() {
  let fakeStateStore: TFakeStateStore
  let fakeTsExec: IFakeExecution
  let fakeLogger: IFakeLogging
  let rolloutAction: IStatefulExecutableAction

  before(() => {
    fakeStateStore = createFakeStateStore()
    fakeLogger = createFakeLogger()

    fakeTsExec = initFakeExecution()

    rolloutAction = createRolloutWaitActionFactory({
      exec: fakeTsExec.exec,
      logger: fakeLogger,
      stateStore: fakeStateStore,
    }).createRolloutWaitAction({
      namespace: "default",
      deploymentName: "my-awesome-deployment",
      deploymentKind: "Deployment",
    })
  })

  it("should remember descriptor", function() {
    assert.strictEqual(rolloutAction.descriptor, "kubectl --namespace default rollout status Deployment/my-awesome-deployment")
  })

  it("should remember descriptor", function() {
    assert.strictEqual(rolloutAction.planString && rolloutAction.planString(), "kubectl --namespace default rollout status Deployment/my-awesome-deployment")
  })

  describe("executing rollout action with waitForRollout true", function() {
    let execResult: IStatefulExecutableAction

    before(async () => {
      fakeLogger.logStatements = []
      fakeTsExec.executedCommands = []
      return (execResult = await rolloutAction.execute(defaultTestExecutionOptions))
    })

    it("should execute if action execution options state that we want to wait for rollout", () => {
      assert.ok(JSON.stringify(execResult.descriptor).includes("Deployment/my-awesome-deployment"))
    })

    it("should execute kubectl rollout status", () => {
      assert.deepStrictEqual(fakeTsExec.executedCommandLines()[0], "kubectl --namespace default rollout status Deployment/my-awesome-deployment")
    })
  })

  describe("executing rollout action with waitForRollout true and wait timeout", function() {
    let execResult: IStatefulExecutableAction

    before(async () => {
      fakeLogger.logStatements = []
      fakeTsExec.executedCommands = []
      let deploymentOptions: TActionExecutionOptions = {
        pushToUi: false,
        waitForRollout: true,
        rolloutWaitSeconds: 44,
        dryRun: false,
        dryRunOutputDir: undefined,
        logContext: {},
      }

      return (execResult = await rolloutAction.execute(deploymentOptions))
    })

    it("should execute kubectl rollout status with timeout option", () => {
      assert.deepStrictEqual(fakeTsExec.executedCommandLines()[0], "kubectl --namespace default rollout status --timeout=44s Deployment/my-awesome-deployment")
    })
  })

  describe("executing rollout action with waitForRollout false", function() {
    before(async () => {
      fakeLogger.logStatements = []
      fakeTsExec.executedCommands = []
      let deploymentOptions: TActionExecutionOptions = {
        pushToUi: false,
        waitForRollout: false,
        dryRun: false,
        dryRunOutputDir: undefined,
        logContext: {},
      }
      await rolloutAction.execute(deploymentOptions)
    })

    it("should not execute kubectl rollout status", () => {
      assert.ok(!fakeTsExec.executedCommandLines().join("").includes("rollout status"))
    })
  })

  /*
  Should time out after given period on rollout status
* Should rollback deployment on rollout status error
* Should fail build on rollout status error
* Do we want to optionally issue a warning? Does that make any sense?
* Apply old deployment after kubectl rollback?
* */
  describe("executing failing rollout action", function() {
    let execResult: IStatefulExecutableAction

    let caughtErr: Oops

    before(async () => {
      fakeLogger.logStatements = []
      fakeTsExec.executedCommands = []
      fakeTsExec.addResponse({ code: 99, stderr: "Rollout failed" })
      fakeTsExec.addResponse({ code: 77, stderr: "Undo failed" })

      try {
        return (execResult = await rolloutAction.execute({
          pushToUi: false,
          waitForRollout: true,
          dryRun: false,
          dryRunOutputDir: undefined,
          logContext: {},
        }))
      } catch (err) {
        caughtErr = err
      }
    })

    it("should throw error with meaningful message", () => {
      assert.strictEqual(caughtErr.message, "Error waiting for rollout to finish. kubectl --namespace default rollout status Deployment/my-awesome-deployment. Process exited with error code 99\nRollback undo was attempted, but failed!")
    })

    it("should execute rollout undo", () => {
      assert.strictEqual(fakeTsExec.executedCommandLines()[1], "kubectl --namespace default rollout undo deployment/my-awesome-deployment")
    })

    it("should log that rollout was undone", () => {
      assert.strictEqual(fakeLogger.logLevelEntries("warn")[0][0], "kubectl --namespace default rollout undo deployment/my-awesome-deployment. Process exited with error code 77")
    })

    it("should log that undo failed on error level", () => {
      assert.strictEqual(fakeLogger.logLevelEntries("error")[0][0], "Undo failed")
    })
  })
})
