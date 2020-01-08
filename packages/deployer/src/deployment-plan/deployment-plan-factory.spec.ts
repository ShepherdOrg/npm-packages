import { DeploymentPlanFactory, TDeploymentPlan } from "./deployment-plan-factory"
import {
  clearEnv,
  createTestActions,
  k8sImageInformation, setEnv,
  testEnvImageMigrations,
} from "../deployment-actions/test-action-factory"
import { expect } from "chai"
import { createFakeExec, TFakeExec } from "../test-tools/fake-exec"
import { createFakeStateStore, TFakeStateStore } from "../deployment-orchestration/fake-state-store-factory"
import { CreateFakeLogger } from "../test-tools/fake-logger"


describe("Deployment plan", function() {
  let depPlan: TDeploymentPlan
  let depPlanner: { createDeploymentPlan: (herdKey: string) => TDeploymentPlan }
  let fakeExecCmd: TFakeExec
  let fakeStateStore: TFakeStateStore

  let testEnv = {
    EXPORT1: "export1",
    MICRO_SITES_DB_PASSWORD: "pass",
    SUB_DOMAIN_PREFIX: ".prefix",
    PREFIXED_TOP_DOMAIN_NAME: ".com",
  }

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
    const deployerTestActions = await createTestActions(testEnvImageMigrations)
    await Promise.all(deployerTestActions.map(depPlan.addAction))
    const k8sTestActions = await createTestActions(k8sImageInformation)
    await Promise.all(k8sTestActions.map(depPlan.addAction))

  })

  it("should add deployment actions along with wait and e2e actions", async () => {
    expect(depPlan.deploymentActions.length).to.equal(6)
  })

  it("should retrieve action state from state store", async () => {
    expect(depPlan.deploymentActions[0].state).not.to.equal(undefined)
  })

  describe("execute", function() {
    before(()=>{
      return depPlan.execute({dryRun: false, waitForRollout:false, pushToUi:false, dryRunOutputDir: ""})
    })
  })

  it("should execute all deployment actions in serial", () => {

    expect(fakeExecCmd.executedCommands)

  })

})
