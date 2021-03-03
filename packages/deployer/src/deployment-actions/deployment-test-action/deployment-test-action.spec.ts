import { TDeployerMetadata, TTestSpecification } from "@shepherdorg/metadata"
import {
  createDeploymentTestActionFactory,
  IRollbackAction,
  TDeploymentTestActionFactoryDependencies,
} from "./deployment-test-action"
import { IStatefulExecutableAction, TActionExecutionOptions, TRollbackResult } from "../../deployment-types"
import { metadataDsl } from "../../test-tools/metadata-dsl"
import { expect } from "chai"
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
      expect(testAction.planString()).to.contain("pretest")
    })

    it("should generate environment parameters for docker run", () => {
      expect(testAction.descriptor).to.contain("-e ENV_ONE=VALUE_ONE")
    })

    it("should default to dockerImageUrl from shepherdMetadata", () => {
      expect(testAction.planString()).to.contain("unittest-image:9.9.99")
    })

    it("should be stateless", () => {
      expect(testAction.isStateful).to.equal(false)
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
      expect(testAction.planString()).to.contain("test-specific-image:999")
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
      expect(fakeExec.executedCommands.length).to.equal(1)
    })

    it("should execute with correct parameters", () => {
      expect(fakeExec.executedCommands[0].params.join(" ")).to.equal(
        "run -i --rm -e ENV=testenv -e ENV_ONE=VALUE_ONE unittest-image:9.9.99 pretest this param"
      )
    })

    it("should split command into parameters and not pass as a single string", () => {
      expect(fakeExec.executedCommands[0].params[8]).to.equal("pretest")
      expect(fakeExec.executedCommands[0].params[9]).to.equal("this")
      expect(fakeExec.executedCommands[0].params[10]).to.equal("param")
    })

    it("should execute docker", () => {
      expect(fakeExec.executedCommands[0].command).to.equal("docker")
    })

    it("should output stdout to logger", () => {
      expect(fakeLogger.log).to.contain("Yeah")
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
        expect(testFailError.message).to.contain(
          "docker run -i --rm -e ENV=testenv -e ENV_ONE=VALUE_ONE unittest-image:9.9.99 pretest this param. Process exited with error code 666"
        )
        expect(testFailError.stderr).to.contain("This did not go well")
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
      expect(fakeRollbackAction.rollbackCalls.length).to.equal(1)
    })

    it("should log fact that test failure resulted in rollback being called", () => {
      expect(fakeLogger.log).to.contain("Test run failed, rolling back to last good version.")
    })

    it("should throw error stating testExecution command", () => {
      expect(testError.message).to.contain(
        "docker run -i --rm -e ENV=testenv -e ENV_ONE=VALUE_ONE unittest-image:10.11.12 postTest. Process exited with error code 33"
      )
    })

    it("should throw error stating testExecution failure", () => {
      expect(testError.stderr).to.contain("This is a failing test result")
    })
  })
})
