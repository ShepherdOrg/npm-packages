import {
  DeploymentPlanFactory,
  IDeploymentPlan,
  IDeploymentPlanFactory,
  TDeploymentPlanDependencies,
} from "./deployment-plan-factory"
import { clearEnv, setEnv } from "../deployment-actions/test-action-factory"
import { expect } from "chai"
import { createFakeExec, TFakeExec } from "../test-tools/fake-exec"
import { createFakeLogger, IFakeLogging } from "../test-tools/fake-logger"
import {
  IExecutableAction,
  IKubectlDeployAction,
  ILog,
  TActionExecutionOptions,
  TDeploymentOptions,
} from "../deployment-types"
import { TDeploymentState } from "@shepherdorg/metadata"
import { emptyArray } from "../helpers/ts-functions"
import { createFakeStateStore, TFakeStateStore } from "@shepherdorg/state-store/dist/fake-state-store-factory"
import { createFakeUIPusher } from "../deployment-orchestration/deployment-orchestration.spec"
import { createRolloutWaitActionFactory } from "../deployment-actions/kubectl-action/rollout-wait-action-factory"


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
  let me : IExecutableAction = {
    descriptor: "",
    pushToUI: false,
    execute(_deploymentOptions: TActionExecutionOptions ): Promise<IExecutableAction> {
      return fakeLambda().then(()=>{
        return me
      })
    },
    planString(){
      return "fake action"

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
    type:"kubectl",
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

export function fakeDeploymentPlanDependencies(): TDeploymentPlanDependencies {
  const fakeLogger = createFakeLogger()
  const fakeExecCmd = createFakeExec()
  fakeExecCmd.nextResponse.success = "exec success"
  const fakeStateStore = createFakeStateStore()
  fakeStateStore.nextState = { new: false, modified: true }

  return { logger: fakeLogger, exec: fakeExecCmd, stateStore: fakeStateStore, uiDataPusher: createFakeUIPusher() }
}

describe("Deployment plan", function() {
  let depPlan: IDeploymentPlan
  let depPlanner: IDeploymentPlanFactory
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

    let planDependencies = fakeDeploymentPlanDependencies()
    depPlanner = DeploymentPlanFactory(planDependencies, createRolloutWaitActionFactory(planDependencies))

    depPlan = depPlanner.createDeploymentPlan({key:"testKeyOne"})
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

  // describe("plan for image with migration reference", function() {
  //
  //   beforeEach(async ()=>{
  //     const testActions = await createTestActions( k8sImageInformation)
  //
  //     await depPlan.addAction(testActions[0])
  //   })
  //
  //   // TODO NEXT for migrations support, move derived action adding to plan or action
  //   it.only("should add migration action to deployment plan", () => {
  //     expect(depPlan.deploymentActions.length).to.equal(2)
  //   })
  //
  //   it("should be a migration action", () => {
  //     expect(depPlan.deploymentActions[1].planString()).to.equal("docker run ....")
  //   })
  //
  // })



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
