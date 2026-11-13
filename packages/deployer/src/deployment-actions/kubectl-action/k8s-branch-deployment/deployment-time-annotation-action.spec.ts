import { createFakeStateStore, TFakeStateStore } from "@shepherdorg/state-store/dist/fake-state-store-factory"
import { createFakeLogger, IFakeLogging } from "@shepherdorg/logger"
import { IStatefulExecutableAction } from "../../../deployment-types"
import { strict as assert } from "node:assert"
import { describe, it, before } from "node:test"
import { createDeploymentTimeAnnotationActionFactory } from "./create-deployment-time-annotation-action"
import { createFakeTimeoutWrapper, TFakeTimeoutWrapper } from "../../../test-tools/fake-timer"
import { defaultTestExecutionOptions } from "../../../test-tools/test-action-execution-options"
import { formatCommandLine, IFakeExecution, initFakeExecution, TExecError } from "@shepherdorg/ts-exec"

describe("Deployment Time Annotation Action", function() {
  describe("For deployment in unspecified namespace", function() {
    let fakeStateStore: TFakeStateStore
    let fakeExec: IFakeExecution
    let fakeLogger: IFakeLogging
    let annotationAction: IStatefulExecutableAction
    let fakeTimeoutWrapper: TFakeTimeoutWrapper

    before(() => {
      fakeStateStore = createFakeStateStore()
      fakeLogger = createFakeLogger()
      fakeExec = initFakeExecution()
      fakeTimeoutWrapper = createFakeTimeoutWrapper()

      annotationAction = createDeploymentTimeAnnotationActionFactory({
        exec: fakeExec.exec,
        logger: fakeLogger,
        systemTime: () => {
          return new Date("2020-08-26T13:23:42.376Z")
        },
        timeout: fakeTimeoutWrapper.fakeTimeout,
      }).createDeploymentTimeAnnotationAction({
        metadata: { name: "test-d-one" },
        spec: {},
        kind: "Deployment",
      })
    })

    it("should create annotation action for deployment", function() {
      assert.strictEqual(annotationAction.descriptor, "kubectl --namespace default annotate --overwrite Deployment test-d-one lastDeploymentTimestamp=2020-08-26T13:23:42.376Z")
    })

    it("should provide descriptor", function() {
      assert.strictEqual(annotationAction.planString && annotationAction.planString(), "kubectl --namespace default annotate --overwrite Deployment test-d-one lastDeploymentTimestamp=2020-08-26T13:23:42.376Z")
    })

    describe("executing annotation action", function() {
      let execResult: IStatefulExecutableAction

      before(async () => {
        fakeLogger.logStatements = []
        fakeExec.executedCommands = []
        return (execResult = await annotationAction.execute(defaultTestExecutionOptions))
      })

      it("should execute kubectl command", () => {
        assert.strictEqual(fakeExec.executedCommands[0].command, "kubectl")
        assert.strictEqual(fakeExec.executedCommands[0].params.join(" "), "--namespace default annotate --overwrite Deployment test-d-one lastDeploymentTimestamp=2020-08-26T13:23:42.376Z")
      })

      it("should execute", () => {
        assert.ok(JSON.stringify(execResult.descriptor).includes("Deployment test-d-one"))
      })
    })

    describe("executing annotation action when resource appears after 4 retries", function() {
      let execResult: IStatefulExecutableAction

      before(async () => {
        let execCount = 0
        fakeLogger.logStatements = []
        fakeExec.executedCommands = []
        fakeExec.addResponse({ code: 99, stderr: "Big messy failure" })
        fakeExec.onExec = async (command, params, options) => {
          if (execCount < 4) {
            throw new TExecError(255, "Fake this error", "Error", "")
          } else {
            execCount++
            return {
              command: formatCommandLine(command, params),
              code: 0,
              stdout: "Nice, annotation successful",
              stderr: "",
            }
          }
        }
        return (execResult = await annotationAction.execute(defaultTestExecutionOptions))
      })

      it("should retry until successful", () => {
        assert.strictEqual(fakeExec.executedCommands.length, 5)
      })

      it("should wait 500 ms between retries", () => {
        assert.strictEqual(fakeTimeoutWrapper.lastRequestedTimeoutMillis(), 500)
      })
    })

    describe("executing annotation action when resource does not appear", function() {
      let execResult: IStatefulExecutableAction

      before(async () => {
        let execCount = 0
        fakeLogger.logStatements = []
        fakeExec.executedCommands = []
        fakeExec.addResponse({ code: 33, stderr: "Big messy failure", stdout: "undefined" })
        fakeExec.onExec = async (command, params, options) => {
          execCount++
          if (execCount > 100) {
            throw new Error("Heading for stack overflow!")
          }

          throw new TExecError(-1, "Fake this error", "", "")
        }
        annotationAction = createDeploymentTimeAnnotationActionFactory({
          exec: fakeExec.exec,
          logger: fakeLogger,
          systemTime: () => {
            return new Date("2020-08-26T13:23:42.376Z")
          },
          timeout: fakeTimeoutWrapper.fakeTimeout,
        }).createDeploymentTimeAnnotationAction({
          metadata: { name: "test-d-one" },
          spec: {},
          kind: "Deployment",
        })

        return (execResult = await annotationAction.execute(defaultTestExecutionOptions))
      })

      it("should retry until max retries reached", () => {
        assert.strictEqual(fakeExec.executedCommands.length, 5)
      })

      it("should wait 500 ms between retries", () => {
        assert.strictEqual(fakeTimeoutWrapper.lastRequestedTimeoutMillis(), 500)
      })
    })
  })
})
