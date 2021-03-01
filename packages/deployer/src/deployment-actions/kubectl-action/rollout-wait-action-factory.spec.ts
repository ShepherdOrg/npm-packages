import { expect } from "chai"
import { createRolloutWaitActionFactory } from "./rollout-wait-action-factory"

import { createFakeStateStore, TFakeStateStore } from "@shepherdorg/state-store/dist/fake-state-store-factory"
import { createFakeLogger, IFakeLogging } from "../../test-tools/fake-logger"
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
    expect(rolloutAction.descriptor).to.equal(
      "kubectl --namespace default rollout status Deployment/my-awesome-deployment"
    )
  })

  it("should remember descriptor", function() {
    expect(rolloutAction.planString && rolloutAction.planString()).to.equal(
      "kubectl --namespace default rollout status Deployment/my-awesome-deployment"
    )
  })

  describe("executing rollout action with waitForRollout true", function() {
    let execResult: IStatefulExecutableAction

    before(async () => {
      fakeLogger.logStatements = []
      fakeTsExec.executedCommands = []
      return (execResult = await rolloutAction.execute(defaultTestExecutionOptions))
    })

    it("should execute if action execution options state that we want to wait for rollout", () => {
      expect(JSON.stringify(execResult.descriptor)).to.contain("Deployment/my-awesome-deployment")
    })

    it("should execute kubectl rollout status", () => {
      expect(fakeTsExec.executedCommandLines()[0]).to.eql(
        "kubectl --namespace default rollout status Deployment/my-awesome-deployment"
      )
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
      expect(fakeTsExec.executedCommandLines().join("")).not.to.contain("rollout status")
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
      fakeTsExec.addResponse({ code: 99, stderr: "Rollout failed", stdout: "" })
      fakeTsExec.addResponse({ code: 77, stderr: "Undo failed", stdout: "" })

      try {
        return (execResult = await rolloutAction.execute({
          pushToUi: false,
          waitForRollout: true,
          rolloutWaitSeconds: 44,
          dryRun: false,
          dryRunOutputDir: undefined,
          logContext: {},
        }))
      } catch (err) {
        caughtErr = err
      }
    })

    it("should encapsulate error from exec", () => {
      expect(caughtErr.message).to.equal(
        "Error waiting for rollout to finish. kubectl --namespace default rollout status Deployment/my-awesome-deployment exited with error code 99"
      )
    })

    it("should execute rollout undo", () => {
      expect(fakeTsExec.executedCommandLines()[1]).to.equal(
        "kubectl --namespace default rollout undo deployment/my-awesome-deployment"
      )
    })

    it("should have warning log lines", () => {
      let warningLogLines = fakeLogger.logStatements.filter(ls => {
        return ls.logLevel === "warn"
      })
      expect(warningLogLines.length).to.eql(3)
    })
  })
})
