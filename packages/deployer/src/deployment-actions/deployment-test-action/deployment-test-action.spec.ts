import { TDeployerMetadata, TTestSpecification } from "@shepherdorg/metadata"
import {
  createDeploymentTestActionFactory,
  IRollbackAction,
  TDeploymentTestActionFactoryDependencies,
} from "./deployment-test-action"
import { IStatefulExecutableAction, TActionExecutionOptions, TRollbackResult } from "../../deployment-types"
import { metadataDsl } from "../../test-tools/metadata-dsl"
import { strict as assert } from "node:assert"
import { describe, it, before } from "node:test"
import { createFakeStateStore, TFakeStateStore } from "@shepherdorg/state-store/dist/fake-state-store-factory"
import { createFakeLogger, IFakeLogging } from "@shepherdorg/logger"
import { createDockerActionFactory } from "../docker-action/docker-action"
import { defaultTestExecutionOptions } from "../../test-tools/test-action-execution-options"
import { IFakeExecution, initFakeExecution, TExecError } from "@shepherdorg/ts-exec"

export function createFakeDeploymentTestActionFactoryDependencies(): TDeploymentTestActionFactoryDependencies & {
  logger: IFakeLogging
  exec: IFakeExecution
  stateStore: TFakeStateStore
} {
  let logger = createFakeLogger()
  let tsFakeExec = initFakeExecution()
  let stateStore = createFakeStateStore()
  const dockerActionFactory = createDockerActionFactory({ stateStore, exec: tsFakeExec.exec, logger })
  return { dockerActionFactory, logger, exec: tsFakeExec, stateStore }
}

describe("Deployment test action", function() {
  describe("Plain test action creation", function() {
    const testDeclaration: TTestSpecification = {
      inEnvironments: [],
      command: "pretest",
      environment: [{ name: "ENV_ONE", value: "VALUE_ONE" }],
    }
    let testAction: IStatefulExecutableAction

    before(() => {
      const shepherdMetadata: TDeployerMetadata = metadataDsl()
        .dockerImageUrl("unittest-image:9.9.99")
        .instance()
      testAction = createDeploymentTestActionFactory(
        createFakeDeploymentTestActionFactoryDependencies()
      ).createDeploymentTestAction(testDeclaration, shepherdMetadata)
    })

    it("should plan docker run on image with specified test command", () => {
      assert.ok(testAction.planString().includes("pretest"))
    })

    it("should generate environment parameters for docker run", () => {
      assert.ok(testAction.descriptor.includes("-e ENV_ONE=VALUE_ONE"))
    })

    it("should default to dockerImageUrl from shepherdMetadata", () => {
      assert.ok(testAction.planString().includes("unittest-image:9.9.99"))
    })

    it("should be stateless", () => {
      assert.strictEqual(testAction.isStateful, false)
    })
  })

  describe("plain test action creation, another image", () => {
    let testAction: IStatefulExecutableAction
    const testDeclaration: TTestSpecification = {
      command: "pretest",
      dockerImageUrl: "test-specific-image:999",
      inEnvironments: [],
    }

    before(() => {
      const shepherdMetadata: TDeployerMetadata = metadataDsl().instance()
      testAction = createDeploymentTestActionFactory(
        createFakeDeploymentTestActionFactoryDependencies()
      ).createDeploymentTestAction(testDeclaration, shepherdMetadata)
    })

    it("should ", () => {
      assert.ok(testAction.planString().includes("test-specific-image:999"))
    })
  })

  describe("Plain deployment test action execution", function() {
    const testDeclaration: TTestSpecification = {
      inEnvironments: [],
      command: "pretest this param",
      environment: [{ name: "ENV_ONE", value: "VALUE_ONE" }],
    }
    let testAction: IStatefulExecutableAction

    let fakeStateStore: TFakeStateStore
    let fakeExec: IFakeExecution
    let fakeLogger: IFakeLogging
    let execResult: IStatefulExecutableAction

    let deploymentOptions = defaultTestExecutionOptions

    before(async () => {
      let fakeDeploymentTestActionFactoryDependencies = createFakeDeploymentTestActionFactoryDependencies()
      fakeStateStore = fakeDeploymentTestActionFactoryDependencies.stateStore as TFakeStateStore
      fakeLogger = fakeDeploymentTestActionFactoryDependencies.logger as IFakeLogging
      fakeExec = fakeDeploymentTestActionFactoryDependencies.exec

      fakeExec.addResponse({ stdout: "Yeah" })

      const shepherdMetadata: TDeployerMetadata = metadataDsl()
        .dockerImageUrl("unittest-image:9.9.99")
        .instance()
      testAction = createDeploymentTestActionFactory(
        fakeDeploymentTestActionFactoryDependencies
      ).createDeploymentTestAction(testDeclaration, shepherdMetadata)

      return (execResult = await testAction.execute(deploymentOptions))
    })

    it("should execute docker run once", () => {
      assert.strictEqual(fakeExec.executedCommands.length, 1)
    })

    it("should execute with correct parameters", () => {
      assert.strictEqual(fakeExec.executedCommands[0].params.join(" "), "run -i --rm -e ENV=testenv -e ENV_ONE=VALUE_ONE unittest-image:9.9.99 pretest this param")
    })

    it("should split command into parameters and not pass as a single string", () => {
      assert.strictEqual(fakeExec.executedCommands[0].params[8], "pretest")
      assert.strictEqual(fakeExec.executedCommands[0].params[9], "this")
      assert.strictEqual(fakeExec.executedCommands[0].params[10], "param")
    })

    it("should execute docker", () => {
      assert.strictEqual(fakeExec.executedCommands[0].command, "docker")
    })

    it("should output stdout to logger", () => {
      assert.ok(fakeLogger.log.includes("Yeah"))
    })

    describe("Failing test run", function() {
      let testFailError: TExecError

      before(async () => {
        fakeExec.addResponse({ code: 666, stderr: "This did not go well" })
        return await testAction.execute(deploymentOptions).catch((testErr: TExecError) => {
          testFailError = testErr
        })
      })

      it("should fail nicely", () => {
        assert.ok(testFailError.message.includes("docker run -i --rm -e ENV=testenv -e ENV_ONE=VALUE_ONE unittest-image:9.9.99 pretest this param. Process exited with error code 666"))
        assert.ok(testFailError.stderr.includes("This did not go well"))
      })
    })
  })

  describe("postDeployTest action execution", function() {
    const testDeclaration: TTestSpecification = {
      inEnvironments: [],
      command: "postTest",
      environment: [{ name: "ENV_ONE", value: "VALUE_ONE" }],
    }
    let postDeployTestAction: IStatefulExecutableAction

    let fakeStateStore: TFakeStateStore
    let fakeExec: IFakeExecution
    let fakeLogger: IFakeLogging
    let execResult: IStatefulExecutableAction
    let testError: TExecError

    let deploymentOptions = defaultTestExecutionOptions
    let fakeRollbackAction: IRollbackAction & { rollbackCalls: Array<any> }

    before(async () => {
      let fakeDeploymentTestActionFactoryDependencies = createFakeDeploymentTestActionFactoryDependencies()
      fakeStateStore = fakeDeploymentTestActionFactoryDependencies.stateStore as TFakeStateStore
      fakeLogger = fakeDeploymentTestActionFactoryDependencies.logger as IFakeLogging

      fakeExec = fakeDeploymentTestActionFactoryDependencies.exec.addResponse({
        stderr: "This is a failing test result",
        code: 33,
      })

      const shepherdMetadata: TDeployerMetadata = metadataDsl()
        .dockerImageUrl("unittest-image:10.11.12")
        .instance()

      fakeRollbackAction = {
        rollbackCalls: [],
        async rollback(): Promise<TRollbackResult> {
          fakeRollbackAction.rollbackCalls.push(arguments)
          return { code: 0 }
        },
      }
      postDeployTestAction = createDeploymentTestActionFactory(
        fakeDeploymentTestActionFactoryDependencies
      ).createDeploymentTestAction(testDeclaration, shepherdMetadata, fakeRollbackAction)

      return (execResult = await postDeployTestAction.execute(deploymentOptions).catch(testErr => {
        testError = testErr
        return postDeployTestAction
      }))
    })

    it("should invoke rollback on test failure", () => {
      assert.strictEqual(fakeRollbackAction.rollbackCalls.length, 1)
    })

    it("should log fact that test failure resulted in rollback being called", () => {
      assert.ok(fakeLogger.log.includes("Test run failed, rolling back to last good version."))
    })

    it("should throw error stating testExecution command", () => {
      assert.ok(testError.message.includes("docker run -i --rm -e ENV=testenv -e ENV_ONE=VALUE_ONE unittest-image:10.11.12 postTest. Process exited with error code 33"))
    })

    it("should throw error stating testExecution failure", () => {
      assert.ok(testError.stderr.includes("This is a failing test result"))
    })
  })
})
