import { TestActions, TK8sDockerImageDeploymentActionStruct } from "../../herd-loading/testdata/testActions"
import { createFakeExec, TFakeExec } from "../../test-tools/fake-exec"
import { createFakeLogger, IFakeLogging } from "../../test-tools/fake-logger"
import { createFakeStateStore, TFakeStateStore } from "@shepherdorg/state-store/dist/fake-state-store-factory"
import { expect } from "chai"
import { IKubectlDeployAction, TRollbackResult } from "../../deployment-types"
import { createKubectlDeploymentActionFactory } from "./kubectl-deployment-action-factory"

export function createKubectlTestDeployAction(
  serialisedAction: TK8sDockerImageDeploymentActionStruct,
  iFakeLogging: IFakeLogging, fakeExec: TFakeExec, stateStore: TFakeStateStore,
): IKubectlDeployAction {

  const actionFactory = createKubectlDeploymentActionFactory({
    exec: fakeExec,
    logger: iFakeLogging,
    stateStore: stateStore,
  })

  // @ts-ignore
  return actionFactory.createKubectlDeployAction("testOrigin", serialisedAction.metadata.kubeDeploymentFiles["./deployment/www-icelandair-com.deployment.yml"].content, "apply", "testDeployment/test", iFakeLogging)
}

describe.only("Kubectl deployment action factory", function() {

  describe("Deployment document without a kube deployment section", function() {

    it("should not be able to roll back", () => {
    })
  })

  describe("Deployment document with a kube deployment section", function() {
    let fakeStateStore: any
    let fakeExec: TFakeExec
    let fakeLogger: IFakeLogging

    let testAction: IKubectlDeployAction

    before(() => {
      process.env.TPL_DOCKER_IMAGE = "does-not-matter"
      process.env.EXPORT1 = "does-not-matter-either"
      fakeExec = createFakeExec()
      fakeStateStore = createFakeStateStore()
      fakeLogger = createFakeLogger()
      testAction = createKubectlTestDeployAction(TestActions.addedK8sDeployments["Service_www-icelandair-com-internal"] as TK8sDockerImageDeploymentActionStruct, fakeLogger, fakeExec, fakeStateStore)
    })

    after(() => {
      delete process.env.TPL_DOCKER_IMAGE
      delete process.env.EXPORT1
    })

    it("should be able to roll back", () => {
      expect(testAction.canRollbackExecution()).to.be.equal(true)
    })

    describe("executing rollback", function() {
      let rollbackResult: TRollbackResult
      before(async () => {
        rollbackResult = (testAction.canRollbackExecution() && await testAction.rollback() || {})
      })

      it("should get rollback results", () => {
        expect(rollbackResult).not.to.equal(undefined)
      })

      it("should rollback using kubectl rollout undo", () => {
        expect(fakeExec.executedCommands[0].command).to.eql('kubectl')
        expect(fakeExec.executedCommands[0].params).to.eql([
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

    it("should be able to roll back by applying previous version again", () => {

    })

    it("should not use kubectl rollout undo for rollback", () => {

    })

  })

})
