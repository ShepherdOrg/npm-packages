import { expect } from "chai"

import { createFakeExec, TFakeExec } from "../../test-tools/fake-exec"
import { createFakeStateStore, TFakeStateStore } from "@shepherdorg/state-store/dist/fake-state-store-factory"
import { createFakeLogger, IFakeLogging } from "../../test-tools/fake-logger"
import { IExecutableActionV2, TActionExecutionOptions, TRollbackResult } from "../../deployment-types"
import { Oops } from "oops-error"
import { createRolloutUndoActionFactory } from "./rollout-undo-actionfactory"

describe("K8S deployment rollout undo factory", function() {
  let fakeStateStore: TFakeStateStore
  let fakeExec: TFakeExec
  let fakeLogger: IFakeLogging
  let undoAction: IExecutableActionV2<TRollbackResult>

  before(() => {
    fakeStateStore = createFakeStateStore()
    fakeLogger = createFakeLogger()

    fakeExec = createFakeExec()

    undoAction = createRolloutUndoActionFactory({
      exec: fakeExec,
      logger: fakeLogger,
    }).createRolloutUndoAction({
      namespace: "default",
      deploymentName: "my-awesome-deployment",
      deploymentKind: "Deployment",
    })
  })

  it("should plan rollout undo", function() {
    expect(undoAction.planString()).to.equal(
      "kubectl --namespace default rollout undo deployment/my-awesome-deployment"
    )
  })

  describe("executing rollout undo", function() {
    before(async () => {
      fakeLogger.logStatements = []
      fakeExec.executedCommands = []
      let deploymentOptions: TActionExecutionOptions = {
        pushToUi: false,
        waitForRollout: false,
        dryRun: false,
        dryRunOutputDir: undefined,
        logContext: {},
      }
      await undoAction.execute(deploymentOptions)
    })

    it("should not execute kubectl rollout status", () => {
      expect(fakeExec.executedCommands.map(ec => ec.command + " " + ec.params.join(" ")).join("")).not.to.contain(
        "rollout status"
      )
    })
  })

  /*
  Should time out after given period on rollout status
* Should rollback deployment on rollout status error
* Should fail build on rollout status error
* Do we want to optionally issue a warning? Does that make any sense?
* Apply old deployment after kubectl rollback?
* */
  describe("executing failing rollout undo action", function() {
    let execResult: TRollbackResult

    let caughtErr: Oops

    before(async () => {
      fakeLogger.logStatements = []
      fakeExec.executedCommands = []
      fakeExec.setErr("Rollout undo failure", 43)

      try {
        return (execResult = await undoAction.execute({
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

    it("should not throw error (we are not doing undo without another error present, which will be rethrown)", () => {
      expect(caughtErr).to.equal(undefined)
    })

    it("should have return code in result", () => {
      expect(execResult.code).to.equal(43)
    })

    it("should warn about undo failure", () => {
      expect(
        fakeLogger.logStatements.filter(ls => {
          return ls.logLevel === "warn"
        }).length
      ).to.equal(3)
    })
  })
})
