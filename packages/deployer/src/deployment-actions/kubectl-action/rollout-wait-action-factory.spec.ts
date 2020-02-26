import { expect } from "chai"
import { createRolloutWaitActionFactory } from "./rollout-wait-action-factory"

import { createFakeExec, TFakeExec } from "../../test-tools/fake-exec"
import { createFakeStateStore, TFakeStateStore } from "@shepherdorg/state-store/dist/fake-state-store-factory"
import { createFakeLogger, IFakeLogging } from "../../test-tools/fake-logger"
import { IExecutableAction, TActionExecutionOptions } from "../../deployment-types"
import { defaultTestExecutionOptions } from "../../herd-loading/image-loader/deployment-test-action.spec"


describe("K8S deployment rollout status wait action factory", function() {

  let fakeStateStore: TFakeStateStore
  let fakeExec: TFakeExec
  let fakeLogger: IFakeLogging
  let rolloutAction: IExecutableAction

  before(()=>{
    fakeStateStore = createFakeStateStore()
    fakeLogger = createFakeLogger()

    fakeExec = createFakeExec()

    rolloutAction = createRolloutWaitActionFactory({ exec: fakeExec, logger:fakeLogger, stateStore: fakeStateStore}).createRolloutWaitAction({namespace:'default', deploymentName:"my-awesome-deployment", deploymentKind:"Deployment"})
  })

  it("should remember descriptor", function() {
    expect(rolloutAction.descriptor).to.equal("kubectl --namespace default rollout status Deployment/my-awesome-deployment")
  })

  it("should remember descriptor", function() {
    expect(rolloutAction.planString && rolloutAction.planString()).to.equal("kubectl --namespace default rollout status Deployment/my-awesome-deployment")
  })


  describe("executing rollout action with waitForRollout true", function() {

    let execResult: IExecutableAction

    before(async ()=>{
      fakeLogger.logStatements = []
      fakeExec.executedCommands = []
      return execResult = await rolloutAction.execute(defaultTestExecutionOptions )
    })

    it("should execute if action execution options state that we want to wait for rollout", () => {
      expect(JSON.stringify(execResult.descriptor)).to.contain('Deployment/my-awesome-deployment')
    })

    it("should execute kubectl rollout status", () => {
      expect(fakeExec.executedCommands.map((ec)=>ec.command + ' ' + ec.params.join(' ')).join('')).to.contain('kubectl --namespace default rollout status Deployment/my-awesome-deployment')
    })
  })

  describe("executing rollout action with waitForRollout false", function() {

    before(async ()=>{
      fakeLogger.logStatements = []
      fakeExec.executedCommands = []
      let deploymentOptions: TActionExecutionOptions = {
        pushToUi: false,
        waitForRollout: false,
        dryRun: false,
        dryRunOutputDir: undefined
      }
      await rolloutAction.execute(deploymentOptions  )
    })

    it("should not execute kubectl rollout wait", () => {
      expect(fakeExec.executedCommands.map((ec)=>ec.command + ' ' + ec.params.join(' ')).join('')).not.to.contain('rollout status')
    })

  })

})
