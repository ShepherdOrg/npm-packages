import {
  createDeploymentPlanFactory,
  IDeploymentPlan,
  IDeploymentPlanExecutionResult,
  IDeploymentPlanFactory,
  TDeploymentPlanDependencies,
} from "./deployment-plan"
import { clearEnv, setEnv } from "../deployment-actions/kubectl-action/testdata/test-action-factory"
import { expect } from "chai"
import { createFakeExec } from "../test-tools/fake-exec"
import { createFakeLogger, IFakeLogging } from "../test-tools/fake-logger"
import { IExecutableAction, TActionExecutionOptions } from "../deployment-types"
import { emptyArray } from "../helpers/ts-functions"
import { createFakeStateStore } from "@shepherdorg/state-store/dist/fake-state-store-factory"
import { createFakeUIPusher } from "../deployment-orchestration/deployment-orchestration.spec"
import { createRolloutWaitActionFactory } from "../deployment-actions/kubectl-action/rollout-wait-action-factory"
import { createDockerImageKubectlDeploymentActionsFactory } from "../deployment-actions/kubectl-action/create-docker-kubectl-deployment-actions"
import { createKubectlDeploymentActionsFactory } from "../deployment-actions/kubectl-action/kubectl-deployment-action-factory"
import { createDockerDeployerActionFactory } from "../deployment-actions/docker-action/create-docker-deployment-action"
import { createDockerActionFactory } from "../deployment-actions/docker-action/docker-action"
import { createDeploymentTestActionFactory } from "../deployment-actions/deployment-test-action/deployment-test-action"
import { createLogContextColors } from "../logging/log-context-colors"
import { TDeploymentState } from "@shepherdorg/metadata"
import * as chalk from "chalk"


type FFakeLambda = () => Promise<void>

interface IFakeLambdaFactory {
  succeedingAction: (atext: string) => FFakeLambda,
  failingAction: (atext: string) => FFakeLambda,
  fakeActionCalls: String[]
}

function fakePromiseFactory(): IFakeLambdaFactory {
  let executedActions = emptyArray<String>()

  function resolvingPromise(actionText: string) {
    let fakeLambda = async () => {
      let promise = new Promise((resolve) => setTimeout(() => {
        executedActions.push(actionText)
        resolve()
      }, 10))
      return promise as Promise<void>
    }
    return fakeLambda
  }

  function rejectingPromise(actionText: string) {
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
    succeedingAction: resolvingPromise,
    failingAction: rejectingPromise,
    fakeActionCalls: executedActions,
  }
}

type IFakeExecutableActions = { getInstance: () => IExecutableAction
  stateFul(isStateful: boolean): IFakeExecutableActions
  modified(b: boolean): IFakeExecutableActions
}

function createFakeAction(fakeLambda: FFakeLambda): IFakeExecutableActions {
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

  function newFakeState() : TDeploymentState {
    return {
      env: "unittest", key: "", modified: false, new: false, operation: "fake", signature: "nosignature", version: "fakeVersion"

    }
  }

  let factory: IFakeExecutableActions = {
    modified(b: boolean): IFakeExecutableActions {
      me.state = me.state || newFakeState()
      me.state.modified = b
      return factory;
    },
    stateFul(isStateful: boolean): IFakeExecutableActions {
      me.isStateful = isStateful
      return factory;
    },
    getInstance:()=>{
      return me
    }
  }
  return factory
}

// function createFakeKubeCtlAction(fakeLambda: FFakeLambda, deploymentRollouts: any[], modified: boolean): IKubectlDeployAction {
//
//   const fakeAction = createFakeAction(fakeLambda)
//
//   let actionState: TDeploymentState = {
//     env: "", key: "", modified: modified, new: false, operation: "apply", signature: "", version: "",
//   }
//   return {
//     ...fakeAction,
//     type: "kubectl",
//     deploymentRollouts: deploymentRollouts,
//     descriptor: "so fake",
//     fileName: "/path/to/nowhere",
//     identifier: "",
//     operation: "apply",
//     origin: "",
//     isStateful: true,
//     state: actionState,
//   }
//
// }

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
    deploymentTestActionFactory: deploymentTestActionFactory,
    logContextColors: createLogContextColors()
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
      flf = fakePromiseFactory()
      depPlan = depPlanner.createDeploymentPlan({ key: "testKeyOne" })

      await depPlan.addAction(createFakeAction(flf.succeedingAction("FakeAction1")).getInstance())
      await depPlan.addAction(createFakeAction(flf.succeedingAction("FakeAction2")).getInstance())
      await depPlan.addAction(createFakeAction(flf.succeedingAction("FakeAction3")).getInstance())
    })

    it("should retrieve action state from state store", async () => {
      expect(depPlan.deploymentActions[0].state).not.to.equal(undefined)
    })
  })


  describe("execute", function() {
    before(async () => {
      flf = fakePromiseFactory()
      depPlan = depPlanner.createDeploymentPlan({ key: "testKeyOne" })
      await depPlan.addAction(createFakeAction(flf.succeedingAction("SucceedingActionOne")).getInstance())
      await depPlan.addAction(createFakeAction(flf.succeedingAction("SucceedingActionTwo")).getInstance())
      await depPlan.addAction(createFakeAction(flf.succeedingAction("SucceedingActionThree")).getInstance())
      return depPlan.execute({ dryRun: false, waitForRollout: false, pushToUi: false, dryRunOutputDir: "" , logContext: {}})
    })

    it("should execute all deployment actions in serial", () => {
      expect(flf.fakeActionCalls).to.eql(["SucceedingActionOne", "SucceedingActionTwo","SucceedingActionThree"])
    })

  })

  describe("first action failure should stop subsequent actions", function() {
    let planExecutionResult: IDeploymentPlanExecutionResult

    before(async () => {

      depPlan = depPlanner.createDeploymentPlan({ key: "testKeyOne" })
      flf = fakePromiseFactory()

      await depPlan.addAction(createFakeAction(flf.succeedingAction("SucceedingActionOne")).getInstance())
      await depPlan.addAction(createFakeAction(flf.failingAction("FakeAFailing")).getInstance())
      await depPlan.addAction(createFakeAction(flf.succeedingAction("SucceedingActionTwo")).getInstance())

      planExecutionResult = await depPlan.execute({ dryRun: false, waitForRollout: false, pushToUi: false, dryRunOutputDir: "", logContext: {} })
    })

    it("should not execute anything after first failing action", () => {
      expect(flf.fakeActionCalls.length).to.equal(2)
    })

    it("should render error message from failing action in logger", () => {
      expect((planDependencies.logger as IFakeLogging).log).to.contain('Plan execution error')
      expect((planDependencies.logger as IFakeLogging).log).to.contain('Failing big time')
    })

    it("should return plan execution result marking it as failed", () => {
      expect(planExecutionResult.actionExecutionError?.message).to.contain('Failing big time')
    })

    it("should print plan with header and one line per action", () => {
      let logger = createFakeLogger()
      depPlan.printPlan(logger)
      expect(logger.logStatements[0].data[0]).to.contain('Deploying testKeyOne')
      expect(logger.logStatements.length).to.equal(4)
    })

  })


  describe("plan with no stateful actions", function() {
    let testPlanError: Error

    before(async () => {
      flf = fakePromiseFactory()
      depPlan = depPlanner.createDeploymentPlan({ key: "testKeyOne" })
      await depPlan.addAction(createFakeAction(flf.succeedingAction("SucceedingActionOne")).stateFul(false).modified(true).getInstance())
      return depPlan.execute({ dryRun: false, waitForRollout: false, pushToUi: false, dryRunOutputDir: "" , logContext: {}}).catch((planError)=>{
        testPlanError = planError
      })
    })


    it("error message should contain herd key highlighted in red", () => {
      expect(testPlanError.message).to.contain(`${chalk.red('testKeyOne')}`)
    })

    it("error message should explanation", () => {
      expect(testPlanError.message).to.contain(`has no stateful action!`)
    })

  })

  describe("plan with no deployment action planned", function() {

    before(async () => {
      flf = fakePromiseFactory()
      depPlan = depPlanner.createDeploymentPlan({ key: "testKeyOne" })
      await depPlan.addAction(createFakeAction(flf.succeedingAction("ThisIsATestAction")).stateFul(false).getInstance())
      await depPlan.addAction(createFakeAction(flf.succeedingAction("SucceedingActionOne")).stateFul(true).modified(false).getInstance())
      return depPlan.execute({ dryRun: false, waitForRollout: false, pushToUi: false, dryRunOutputDir: "" , logContext: {}})
    })


    it("should not execute anything", () => {
      expect(flf.fakeActionCalls.length).to.equal(0)

    })

  })



})
