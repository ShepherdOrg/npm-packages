import { TestActions, TK8sDockerImageDeploymentActionStruct } from "../../herd-loading/testdata/testActions"
import { createFakeLogger, IFakeLogging } from "@shepherdorg/logger"
import { createFakeStateStore, TFakeStateStore } from "@shepherdorg/state-store/dist/fake-state-store-factory"
import { strict as assert } from "node:assert"
import { describe, it, before, after } from "node:test"
import { IKubectlDeployAction, TActionExecutionOptions, TRollbackResult } from "../../deployment-types"
import { createKubectlDeploymentActionsFactory } from "./kubectl-deployment-action-factory"
import { IFakeExecution, initFakeExecution } from "@shepherdorg/ts-exec"

export function createKubectlTestDeployAction(
  serialisedAction: TK8sDockerImageDeploymentActionStruct,
  iFakeLogging: IFakeLogging,
  fakeTsExec: IFakeExecution,
  stateStore: TFakeStateStore
): IKubectlDeployAction {
  const actionFactory = createKubectlDeploymentActionsFactory({
    exec: fakeTsExec.exec,
    logger: iFakeLogging,
    stateStore: stateStore,
  })

  return actionFactory.createKubectlDeployAction(
    "testOrigin",
    // @ts-ignore
    serialisedAction.metadata.kubeDeploymentFiles["./deployment/www-icelandair-com.deployment.yml"].content,
    "apply",
    "testDeployment/test"
  )
}

describe("Kubectl deployment action factory", function() {
  describe("Deployment document without a kube deployment section", function() {
    it("should not be able to roll back", () => {})
  })

  describe("Deployment document with a kube deployment section", function() {
    let fakeStateStore: any
    let fakeTsExec: IFakeExecution

    let fakeLogger: IFakeLogging

    let testAction: IKubectlDeployAction

    before(() => {
      process.env.TPL_DOCKER_IMAGE = "does-not-matter"
      process.env.EXPORT1 = "does-not-matter-either"
      fakeStateStore = createFakeStateStore()
      fakeLogger = createFakeLogger()
      fakeTsExec = initFakeExecution()
      testAction = createKubectlTestDeployAction(
        TestActions.addedK8sDeployments["Service_www-icelandair-com-internal"] as TK8sDockerImageDeploymentActionStruct,
        fakeLogger,
        fakeTsExec,
        fakeStateStore
      )
    })

    after(() => {
      delete process.env.TPL_DOCKER_IMAGE
      delete process.env.EXPORT1
    })

    it("should be able to roll back", () => {
      assert.strictEqual(testAction.canRollbackExecution(), true)
    })

    describe("executing rollback", function() {
      let rollbackResult: TRollbackResult
      before(async () => {
        let execOptions: TActionExecutionOptions = {
          dryRun: false,
          dryRunOutputDir: undefined,
          logContext: {},
          pushToUi: false,
          waitForRollout: false,
        }
        rollbackResult = (testAction.canRollbackExecution() && (await testAction.rollback(execOptions))) || { code: 0 }
      })

      it("should get rollback results", () => {
        assert.notStrictEqual(rollbackResult, undefined)
      })

      it("should rollback using kubectl rollout undo", () => {
        assert.deepStrictEqual(fakeTsExec.executedCommands[0].command, "kubectl")
        assert.deepStrictEqual(fakeTsExec.executedCommands[0].params, [
          "--namespace",
          "default",
          "rollout",
          "undo",
          "deployment/www-icelandair-com",
        ])
      })
    })
  })

  describe("With a previous version and a kube deployment section", function() {
    it("should be able to roll back by applying previous version again", () => {})

    it("should not use kubectl rollout undo for rollback", () => {})
  })
})
