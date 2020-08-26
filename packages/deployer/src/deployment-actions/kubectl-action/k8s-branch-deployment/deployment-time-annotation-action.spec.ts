import { createFakeStateStore, TFakeStateStore } from "@shepherdorg/state-store/dist/fake-state-store-factory"
import { createFakeExec, TFakeExec } from "../../../test-tools/fake-exec"
import { createFakeLogger, IFakeLogging } from "../../../test-tools/fake-logger"
import { IExecutableAction } from "../../../deployment-types"
import { expect } from "chai"
import { defaultTestExecutionOptions } from "../../deployment-test-action/deployment-test-action.spec"
import { createDeploymentTimeAnnotationActionFactory } from "./create-deployment-time-annotation-action"
import { createFakeTimeoutWrapper, TFakeTimeoutWrapper } from "../../../test-tools/fake-timer"


describe("Deployment Time Annotation Action", function() {
  describe("For deployment in unspecified namespace", function() {
    let fakeStateStore: TFakeStateStore
    let fakeExec: TFakeExec
    let fakeLogger: IFakeLogging
    let annotationAction: IExecutableAction
    let fakeTimeoutWrapper: TFakeTimeoutWrapper

    before(() => {
      fakeStateStore = createFakeStateStore()
      fakeLogger = createFakeLogger()
      fakeExec = createFakeExec()
      fakeTimeoutWrapper = createFakeTimeoutWrapper()

      annotationAction = createDeploymentTimeAnnotationActionFactory({
        exec: fakeExec,
        logger: fakeLogger,
        systemTime: ()=>{ return new Date("2020-08-26T13:23:42.376Z")},
        timeout: fakeTimeoutWrapper.fakeTimeout
      }).createDeploymentTimeAnnotationAction({
        metadata: { name: "test-d-one"}, spec: {},
        kind:"Deployment"
      })
    })

    it("should create annotation action for deployment", function() {
      expect(annotationAction.descriptor).to.equal(
        "kubectl --namespace default annotate --overwrite Deployment test-d-one lastDeploymentTimestamp=2020-08-26T13:23:42.376Z"
      )
    })

    it("should provide descriptor", function() {
      expect(annotationAction.planString && annotationAction.planString()).to.equal(
        "kubectl --namespace default annotate --overwrite Deployment test-d-one lastDeploymentTimestamp=2020-08-26T13:23:42.376Z"
      )
    })

    describe("executing annotation action", function() {
      let execResult: IExecutableAction

      before(async () => {
        fakeLogger.logStatements = []
        fakeExec.executedCommands = []
        return (execResult = await annotationAction.execute(defaultTestExecutionOptions))
      })

      it("should execute kubectl command", () => {
        expect(fakeExec.executedCommands[0].command).to.equal('kubectl')
        expect(fakeExec.executedCommands[0].params.join(' ')).to.equal('--namespace default annotate --overwrite Deployment test-d-one lastDeploymentTimestamp=2020-08-26T13:23:42.376Z')
      })

      it("should execute", () => {
        expect(JSON.stringify(execResult.descriptor)).to.contain("Deployment test-d-one")
      })

    })

    describe("executing annotation action when resource appears after 4 retries", function() {

      let execResult: IExecutableAction

      before(async () => {
        let execCount=0
        fakeLogger.logStatements = []
        fakeExec.executedCommands = []
        fakeExec.nextResponse = { err: 'Big messy failure', success: undefined}
        fakeExec.onExec = (command, params, options, err, success)=>{
          if(execCount<4){
            err('Fake this error', -1)
          } else {
            success('Nice, annotation successful')
          }
          execCount++
        }
        return (execResult = await annotationAction.execute(defaultTestExecutionOptions))
      })

      it("should retry until successful", () => {
        expect(fakeExec.executedCommands.length).to.equal(5)
      })

      it("should wait 500 ms between retries", () => {
        expect(fakeTimeoutWrapper.lastRequestedTimeoutMillis()).to.equal(500)
      })

    })

    describe("executing annotation action when resource does not appear", function() {

      let execResult: IExecutableAction

      before(async () => {
        let execCount=0
        fakeLogger.logStatements = []
        fakeExec.executedCommands = []
        fakeExec.nextResponse = { err: 'Big messy failure', success: undefined}
        fakeExec.onExec = (command, params, options, err, success)=>{
          execCount++
          if(execCount > 100){
            throw new Error('Heading for stack overflow!')
          }

          err('Fake this error', -1)
        }
        annotationAction = createDeploymentTimeAnnotationActionFactory({
          exec: fakeExec,
          logger: fakeLogger,
          systemTime: ()=>{ return new Date("2020-08-26T13:23:42.376Z")},
          timeout: fakeTimeoutWrapper.fakeTimeout
        }).createDeploymentTimeAnnotationAction({
          metadata: { name: "test-d-one"}, spec: {},
          kind:"Deployment"
        })

        return (execResult = await annotationAction.execute(defaultTestExecutionOptions))
      })

      it("should retry until max retries reached", () => {
        expect(fakeExec.executedCommands.length).to.equal(5)
      })

      it("should wait 500 ms between retries", () => {
        expect(fakeTimeoutWrapper.lastRequestedTimeoutMillis()).to.equal(500)
      })

    })
  })


})
