import { DeploymentPlanFactory, IDeploymentPlan } from "./deployment-plan-factory"
import { clearEnv, setEnv } from "../deployment-actions/test-action-factory"
import { expect } from "chai"
import { createFakeExec, TFakeExec } from "../test-tools/fake-exec"
import { createFakeStateStore, TFakeStateStore } from "../deployment-orchestration/fake-state-store-factory"
import { CreateFakeLogger } from "../test-tools/fake-logger"
import { IExecutableAction, IKubectlDeployAction, ILog, TDeploymentOptions } from "../deployment-types"
import { TDeploymentState } from "@shepherdorg/metadata"
import { emptyArray } from "../helpers/ts-functions"


type FFakeLambda = () => Promise<void>

interface IFakeLambdaFactory {
  createFakeLambda : (atext:string)=>FFakeLambda,
  executedActions: String[]
}

function fakeLambdaFactory() : IFakeLambdaFactory {
  let executedActions = emptyArray<String>()

  function createFakeLambda(actionText: string) {
    let fakeLambda = async () => {
      let promise = new Promise((resolve) => setTimeout(() => {
        executedActions.push(actionText)
        resolve()
      }, 10))
      return promise as Promise<void>
    }
    return fakeLambda
  }


  return {
    createFakeLambda,
    executedActions: executedActions
  }
}

function createFakeAction(fakeLambda: FFakeLambda ):IExecutableAction{
  let me = {
    descriptor: "",
    pushToUI: false,
    execute(_deploymentOptions: TDeploymentOptions & { waitForRollout: boolean; pushToUi: boolean }, _cmd: any, _logger: ILog, _saveDeploymentState: (stateSignatureObject: any) => Promise<TDeploymentState>): Promise<IExecutableAction> {
      return fakeLambda().then(()=>{
        return me
      })
    }
  }
  return me
}

function createFakeKubeCtlAction(fakeLambda:FFakeLambda, deploymentRollouts: any[], modified: boolean): IKubectlDeployAction{

  const fakeAction = createFakeAction(fakeLambda)

  let actionState: TDeploymentState = {
    env: "", key: "", modified: modified, new: false, operation: "apply", signature: "", version: ""
  }
  return {
    ...fakeAction,
    deploymentRollouts: deploymentRollouts,
    descriptor: "so fake",
    fileName: "/path/to/nowhere",
    identifier: "",
    operation: "apply",
    origin: "", 
    pushToUI: false,
    state: actionState
  }

}


describe("Deployment plan", function() {
  let depPlan: IDeploymentPlan
  let depPlanner: { createDeploymentPlan: (herdKey: string) => IDeploymentPlan }
  let fakeExecCmd: TFakeExec
  let fakeStateStore: TFakeStateStore

  let testEnv = {
    EXPORT1: "export1",
    MICRO_SITES_DB_PASSWORD: "pass",
    SUB_DOMAIN_PREFIX: ".prefix",
    PREFIXED_TOP_DOMAIN_NAME: ".com",
  }

  let faf: IFakeLambdaFactory

  before(async function() {
    return setEnv(testEnv)
  })

  after(() => clearEnv(testEnv))


  beforeEach(async ()=>{
    fakeExecCmd = createFakeExec()
    fakeExecCmd.nextResponse.success = "exec success"
    fakeStateStore = createFakeStateStore()
    fakeStateStore.nextState = { new: false, modified: true }

    const fakeLogger = CreateFakeLogger()
    depPlanner = DeploymentPlanFactory({ logger: fakeLogger, cmd: fakeExecCmd, stateStore: fakeStateStore})

    depPlan = depPlanner.createDeploymentPlan("testKeyOne")
    faf = fakeLambdaFactory()
  })

  describe("kubectl action with rollout status", function() {

    beforeEach(async ()=>{
      await depPlan.addAction(createFakeKubeCtlAction(faf.createFakeLambda('FakeKubeAction1'), ['DepRollout1'], false))
    })

    it("should add deployment actions along with rollout", async () => {
      expect(depPlan.deploymentActions.length).to.equal(2)
      expect(depPlan.deploymentActions[1].descriptor).to.contain("rollout status")
    })

  })

  describe('Regular actions', ()=>{

    beforeEach(async ()=>{
      await depPlan.addAction(createFakeAction(faf.createFakeLambda('FakeAction1')))
      await depPlan.addAction(createFakeAction(faf.createFakeLambda('FakeAction2')))
      await depPlan.addAction(createFakeAction(faf.createFakeLambda('FakeAction3')))
    })

    it("should retrieve action state from state store", async () => {
      expect(depPlan.deploymentActions[0].state).not.to.equal(undefined)
    })
  })

  describe("execute", function() {
    before(()=>{
      return depPlan.execute({dryRun: false, waitForRollout:false, pushToUi:false, dryRunOutputDir: ""})
    })

    it("should execute all deployment actions in serial", () => {
      expect(faf.executedActions).to.eql([])
    })

  })


})
