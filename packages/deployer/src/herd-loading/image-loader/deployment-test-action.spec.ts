import { TDeployerMetadata, TDeploymentState, TTestSpecification } from "@shepherdorg/metadata"
import { createDeploymentTestActionFactory, TDeploymentTestActionFactoryDependencies } from "./deployment-test-action"
import {
  IExecutableAction,
  ILog,
  IRollbackActionExecution,
  TActionExecutionOptions,
  TRollbackResult,
} from "../../deployment-types"
import { metadataDsl } from "../../test-tools/metadata-dsl"
import { expect } from "chai"
import { createFakeStateStore, TFakeStateStore } from "@shepherdorg/state-store/dist/fake-state-store-factory"
import { createFakeExec, TFakeExec } from "../../test-tools/fake-exec"
import { createFakeLogger, IFakeLogging } from "../../test-tools/fake-logger"
import { createDockerActionFactory } from "../../deployment-actions/docker-action/docker-action"

export const defaultTestExecutionOptions: TActionExecutionOptions = {
  pushToUi: false,
  waitForRollout: true,
  dryRun: false,
  dryRunOutputDir: undefined,
}


export function createFakeDeploymentTestActionFactoryDependencies(): TDeploymentTestActionFactoryDependencies & {logger: IFakeLogging, exec: TFakeExec, stateStore: TFakeStateStore} {
  let logger = createFakeLogger()
  let exec = createFakeExec()
  let stateStore = createFakeStateStore()
  const dockerActionFactory = createDockerActionFactory({ stateStore, exec, logger })
  return { dockerActionFactory, logger, exec, stateStore }
}

describe("Deployment test action", function() {
  describe("Plain test action creation", function() {
    const testDeclaration: TTestSpecification = {
      command: "pretest",
      environment: [{ name: "ENV_ONE", value: "VALUE_ONE" }],
    }
    let testAction: IExecutableAction

    before(() => {
      const shepherdMetadata: TDeployerMetadata = metadataDsl()
        .dockerImageUrl("unittest-image:9.9.99")
        .instance()
      testAction = createDeploymentTestActionFactory(createFakeDeploymentTestActionFactoryDependencies()).createDeploymentTestAction(testDeclaration, shepherdMetadata)
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
  })

  describe("plain test action creation, another image", () => {
    let testAction: IExecutableAction
    const testDeclaration: TTestSpecification = { command: "pretest", dockerImageUrl: "test-specific-image:999" }

    before(() => {
      const shepherdMetadata: TDeployerMetadata = metadataDsl().instance()
      testAction = createDeploymentTestActionFactory(createFakeDeploymentTestActionFactoryDependencies()).createDeploymentTestAction(testDeclaration, shepherdMetadata)
    })

    it("should ", () => {
      expect(testAction.planString()).to.contain("test-specific-image:999")
    })
  })

  describe("Plain test action execution", function() {
    const testDeclaration: TTestSpecification = {
      command: "pretest",
      environment: [{ name: "ENV_ONE", value: "VALUE_ONE" }],
    }
    let testAction: IExecutableAction

    let fakeStateStore: TFakeStateStore
    let fakeExec: TFakeExec
    let fakeLogger: IFakeLogging
    let execResult: IExecutableAction

    let deploymentOptions = defaultTestExecutionOptions

    before(async () => {
      let fakeDeploymentTestActionFactoryDependencies = createFakeDeploymentTestActionFactoryDependencies()
      fakeStateStore = fakeDeploymentTestActionFactoryDependencies.stateStore as TFakeStateStore
      fakeLogger = fakeDeploymentTestActionFactoryDependencies.logger as IFakeLogging
      fakeExec = fakeDeploymentTestActionFactoryDependencies.exec as TFakeExec

      fakeExec.nextResponse.success = "Yeah"

      const shepherdMetadata: TDeployerMetadata = metadataDsl()
        .dockerImageUrl("unittest-image:9.9.99")
        .instance()
      testAction = createDeploymentTestActionFactory(fakeDeploymentTestActionFactoryDependencies).createDeploymentTestAction(testDeclaration, shepherdMetadata)

      return execResult = await testAction.execute(deploymentOptions)
    })

    it("should execute docker run once", () => {
      expect(fakeExec.executedCommands.length).to.equal(1)
    })

    it("should execute with correct parameters", () => {
      expect(fakeExec.executedCommands[0].params.join(" ")).to.equal("run -i --rm -e ENV=testenv -e ENV_ONE=VALUE_ONE unittest-image:9.9.99 pretest")
    })

    it("should execute docker", () => {
      expect(fakeExec.executedCommands[0].command).to.equal("docker")
    })

    it("should output stdout to logger", () => {
      expect(fakeLogger.log).to.contain("Yeah")
    })

    describe("Failing test run", function() {

      let testFailError: Error

      before(async () => {

        fakeExec.setErr("This did not go well")
        return await testAction.execute(deploymentOptions).catch((testErr: Error) => {
          testFailError = testErr
        })
      })

      it("should fail nicely", () => {
        expect(testFailError.message).to.contain("This did not go well")
      })

    })

  })

  describe("postDeployTest action execution", function() {
    const testDeclaration: TTestSpecification = {
      command: "postTest",
      environment: [{ name: "ENV_ONE", value: "VALUE_ONE" }],
    }
    let postDeployTestAction: IExecutableAction

    let fakeStateStore: TFakeStateStore
    let fakeExec: TFakeExec
    let fakeLogger: IFakeLogging
    let execResult: IExecutableAction
    let testError: Error

    let deploymentOptions = defaultTestExecutionOptions
    let fakeRollbackAction: IExecutableAction & IRollbackActionExecution & { rollbackCalls: Array<any> }

    before(async () => {
      let fakeDeploymentTestActionFactoryDependencies = createFakeDeploymentTestActionFactoryDependencies()
      fakeStateStore = fakeDeploymentTestActionFactoryDependencies.stateStore as TFakeStateStore
      fakeLogger = fakeDeploymentTestActionFactoryDependencies.logger as IFakeLogging
      fakeExec = (fakeDeploymentTestActionFactoryDependencies.exec as TFakeExec).setErr("This is a failing test result")

      const shepherdMetadata: TDeployerMetadata = metadataDsl()
        .dockerImageUrl("unittest-image:10.11.12")
        .instance()

      fakeRollbackAction = {
        rollbackCalls: [],
        descriptor: "",
        isStateful: false,
        async execute(_deploymentOptions: TActionExecutionOptions): Promise<IExecutableAction> {
          return fakeRollbackAction
        },
        async rollback(): Promise<TRollbackResult> {
          fakeRollbackAction.rollbackCalls.push(arguments)
          return {
          }
        },
        canRollbackExecution(): boolean {
          return true
        },
        planString(): string {
          return ""
        },
      }
      postDeployTestAction = createDeploymentTestActionFactory(fakeDeploymentTestActionFactoryDependencies).createDeploymentTestAction(testDeclaration, shepherdMetadata, [fakeRollbackAction])

      return execResult = await postDeployTestAction.execute(deploymentOptions)
        .catch((testErr)=>{
          testError = testErr
          return postDeployTestAction
        })
    })

    it("should invoke rollback on test failure", () => {
      expect(fakeRollbackAction.rollbackCalls.length).to.equal(1)
    })

    it("shout log fact that test failure resulted in rollback being called", () => {
      expect(fakeLogger.log).to.contain('Test failed, rolling back to last good version')
    })

    it("should throw error stating testExecution failure", () => {
      expect(testError.message).to.contain('This is a failing test result')
    })
  })


})
