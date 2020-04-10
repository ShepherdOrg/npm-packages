import {
  createDeploymentPlanFactory,
  IDeploymentPlan, IDeploymentPlanExecutionResult,
  IDeploymentPlanFactory,
  TDeploymentPlanDependencies,
} from "./deployment-plan"
import { clearEnv, setEnv } from "../deployment-actions/kubectl-action/testdata/test-action-factory"
import { expect } from "chai"
import { createFakeExec } from "../test-tools/fake-exec"
import { createFakeLogger, IFakeLogging } from "../test-tools/fake-logger"
import { IExecutableAction, IKubectlDeployAction, TActionExecutionOptions } from "../deployment-types"
import { TDeploymentState } from "@shepherdorg/metadata"
import { emptyArray } from "../helpers/ts-functions"
import { createFakeStateStore } from "@shepherdorg/state-store/dist/fake-state-store-factory"
import {
  createFakeUIPusher,
} from "../deployment-orchestration/deployment-orchestration.spec"
import { createRolloutWaitActionFactory } from "../deployment-actions/kubectl-action/rollout-wait-action-factory"
import { createDockerImageKubectlDeploymentActionsFactory } from "../deployment-actions/kubectl-action/create-docker-kubectl-deployment-actions"
import { createKubectlDeploymentActionsFactory } from "../deployment-actions/kubectl-action/kubectl-deployment-action-factory"
import { createDockerDeployerActionFactory } from "../deployment-actions/docker-action/create-docker-deployment-action"
import { createDockerActionFactory } from "../deployment-actions/docker-action/docker-action"
import { createDeploymentTestActionFactory } from "../deployment-actions/deployment-test-action/deployment-test-action"


type FFakeLambda = () => Promise<void>

interface IFakeLambdaFactory {
  succeedingAction: (atext: string) => FFakeLambda,
  failingAction: (atext: string) => FFakeLambda,
  fakeActionCalls: String[]
}

function fakeLambdaFactory(): IFakeLambdaFactory {
  let executedActions = emptyArray<String>()

  function succeedingAction(actionText: string) {
    let fakeLambda = async () => {
      let promise = new Promise((resolve) => setTimeout(() => {
        executedActions.push(actionText)
        resolve()
      }, 10))
      return promise as Promise<void>
    }
    return fakeLambda
  }

  function failingAction(actionText: string) {
    let fakeLambda = async () => {
      let promise = new Promise((resolve, reject) => setTimeout(() => {
        executedActions.push(actionText)
        reject(new Error('Failing big time'))
      }, 10))
      return promise as Promise<void>
    }
    return fakeLambda
  }


  return {
    succeedingAction: succeedingAction,
    failingAction,
    fakeActionCalls: executedActions,
  }
}

function createFakeAction(fakeLambda: FFakeLambda): IExecutableAction {
  let me: IExecutableAction = {
    canRollbackExecution(): boolean {
      return false
    },
    descriptor: "",
    isStateful: true,
    execute(_deploymentOptions: TActionExecutionOptions): Promise<IExecutableAction> {
      return fakeLambda().then(() => {
        return me
      })
    },
    planString() {
      return "fake action"

    },
  }
  return me
}

function createFakeKubeCtlAction(fakeLambda: FFakeLambda, deploymentRollouts: any[], modified: boolean): IKubectlDeployAction {

  const fakeAction = createFakeAction(fakeLambda)

  let actionState: TDeploymentState = {
    env: "", key: "", modified: modified, new: false, operation: "apply", signature: "", version: "",
  }
  return {
    ...fakeAction,
    type: "kubectl",
    deploymentRollouts: deploymentRollouts,
    descriptor: "so fake",
    fileName: "/path/to/nowhere",
    identifier: "",
    operation: "apply",
    origin: "",
    isStateful: true,
    state: actionState,
  }

}

export function fakeDeploymentPlanDependencies(): TDeploymentPlanDependencies {
  const fakeLogger = createFakeLogger()
  const fakeExec = createFakeExec()
  fakeExec.nextResponse.success = "exec success"
  const fakeStateStore = createFakeStateStore()
  fakeStateStore.nextState = { new: false, modified: true }

  let dockerActionFactory = createDockerActionFactory({ logger:fakeLogger, exec: fakeExec, stateStore: fakeStateStore})
  let deployerActionFactory = createDockerDeployerActionFactory({executionActionFactory: dockerActionFactory, logger: fakeLogger, environment:"deployment-plan-specs"})
  let kubectlDeploymentActionsFactory = createKubectlDeploymentActionsFactory({ logger:fakeLogger, exec: fakeExec, stateStore: fakeStateStore})
  let dockerImageKubectlDeploymentActionFactory = createDockerImageKubectlDeploymentActionsFactory({
    logger: fakeLogger,
    deploymentActionFactory: kubectlDeploymentActionsFactory,
    environment:"fake"
  })
  let rolloutWaitActionFactory = createRolloutWaitActionFactory({
    exec: fakeExec,
    stateStore: fakeStateStore,
    logger: fakeLogger,
  })
  let uiDataPusher = createFakeUIPusher()

  let deploymentTestActionFactory = createDeploymentTestActionFactory({logger: fakeLogger, dockerActionFactory: dockerActionFactory})

  return {
    logger: fakeLogger,
    exec: fakeExec,
    stateStore: fakeStateStore,
    uiDataPusher: uiDataPusher,
    rolloutWaitActionFactory: rolloutWaitActionFactory,
    dockerImageKubectlDeploymentActionFactory: dockerImageKubectlDeploymentActionFactory,
    deployerActionFactory: deployerActionFactory,
    deploymentTestActionFactory: deploymentTestActionFactory
  }
}

describe("Deployment plan", function() {
  let depPlan: IDeploymentPlan
  let depPlanner: IDeploymentPlanFactory

  let testEnv = {
    EXPORT1: "export1",
    MICRO_SITES_DB_PASSWORD: "pass",
    SUB_DOMAIN_PREFIX: ".prefix",
    PREFIXED_TOP_DOMAIN_NAME: ".com",
  }

  let flf: IFakeLambdaFactory
  let planDependencies: TDeploymentPlanDependencies

  before(async function() {
    planDependencies = fakeDeploymentPlanDependencies()
    depPlanner = createDeploymentPlanFactory(planDependencies)

    await setEnv(testEnv)
  })

  after(() => clearEnv(testEnv))


  // describe("plan for image with migration reference", function() {
  //
  //   beforeEach(async ()=>{
  //     const testActions = await createTestActions( k8sImageInformation)
  //
  //     await depPlan.addAction(testActions[0])
  //   })
  //
  //   // TODO NEXT for migrations support, move derived action adding to plan or action
  //   it("should add migration action to deployment plan", () => {
  //     expect(depPlan.deploymentActions.length).to.equal(2)
  //   })
  //
  //   it("should be a migration action", () => {
  //     expect(depPlan.deploymentActions[1].planString()).to.equal("docker run ....")
  //   })
  //
  // })


  describe("Regular actions", () => {

    before(async () => {
      flf = fakeLambdaFactory()
      depPlan = depPlanner.createDeploymentPlan({ key: "testKeyOne" })

      await depPlan.addAction(createFakeAction(flf.succeedingAction("FakeAction1")))
      await depPlan.addAction(createFakeAction(flf.succeedingAction("FakeAction2")))
      await depPlan.addAction(createFakeAction(flf.succeedingAction("FakeAction3")))
    })

    it("should retrieve action state from state store", async () => {
      expect(depPlan.deploymentActions[0].state).not.to.equal(undefined)
    })
  })

  describe("execute", function() {
    before(async () => {
      flf = fakeLambdaFactory()
      depPlan = depPlanner.createDeploymentPlan({ key: "testKeyOne" })
      await depPlan.addAction(createFakeAction(flf.succeedingAction("SucceedingActionOne")))
      await depPlan.addAction(createFakeAction(flf.succeedingAction("SucceedingActionTwo")))
      await depPlan.addAction(createFakeAction(flf.succeedingAction("SucceedingActionThree")))
      return depPlan.execute({ dryRun: false, waitForRollout: false, pushToUi: false, dryRunOutputDir: "" })
    })

    it("should execute all deployment actions in serial", () => {
      expect(flf.fakeActionCalls).to.eql(["SucceedingActionOne", "SucceedingActionTwo","SucceedingActionThree"])
    })

  })

  describe("first action failure should stop subsequent actions", function() {
    let planExecutionResult: IDeploymentPlanExecutionResult

    before(async () => {

      depPlan = depPlanner.createDeploymentPlan({ key: "testKeyOne" })
      flf = fakeLambdaFactory()

      await depPlan.addAction(createFakeAction(flf.succeedingAction("SucceedingActionOne")))
      await depPlan.addAction(createFakeAction(flf.failingAction("FakeAFailing")))
      await depPlan.addAction(createFakeAction(flf.succeedingAction("SucceedingActionTwo")))

      planExecutionResult = await depPlan.execute({ dryRun: false, waitForRollout: false, pushToUi: false, dryRunOutputDir: "" })
    })

    it("should not execute anything after first failing action", () => {
      console.log(`faf.executedActions`, flf.fakeActionCalls)
      expect(flf.fakeActionCalls.length).to.equal(2)
    })

    it("should render error message from failing action in logger", () => {
      expect((planDependencies.logger as IFakeLogging).log).to.contain('Plan execution error')
      expect((planDependencies.logger as IFakeLogging).log).to.contain('Failing big time')
    })

    it("should return plan execution result marking it as failed", () => {
      expect(planExecutionResult.actionExecutionError?.message).to.contain('Failing big time')
    })

  })




})
