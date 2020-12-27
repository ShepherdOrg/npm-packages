import { expect } from "chai"
import { DeploymentOrchestration, IDeploymentOrchestration } from "./deployment-orchestration"
import {
  IAnyDeploymentAction,
  IDockerDeploymentAction,
  IDockerExecutableAction,
  IK8sDirDeploymentAction,
  IDockerImageKubectlDeploymentAction,
  IKubectlDeployAction,
  TActionExecutionOptions, IPushToShepherdUI,
} from "../deployment-types"
import { createKubectlDeploymentActionsFactory } from "../deployment-actions/kubectl-action/kubectl-deployment-action-factory"
import { emptyArray } from "../helpers/ts-functions"
import { createFakeLogger, IFakeLogging } from "../test-tools/fake-logger"
import {
  TDockerDeploymentActionStruct,
  TestActions,
  TK8sDockerImageDeploymentActionStruct,
} from "../herd-loading/testdata/testActions"
import { createDockerActionFactory } from "../deployment-actions/docker-action/docker-action"
import { createFakeExec, TFakeExec } from "../test-tools/fake-exec"
import { createFakeStateStore, TFakeStateStore } from "@shepherdorg/state-store/dist/fake-state-store-factory"
import { createDeploymentPlanFactory, TDeploymentPlanDependencies } from "../deployment-plan/deployment-plan"
import { createRolloutWaitActionFactory } from "../deployment-actions/kubectl-action/rollout-wait-action-factory"
import { ICreateDockerImageKubectlDeploymentActions } from "../deployment-actions/kubectl-action/create-docker-kubectl-deployment-actions"
import {
  createDockerDeployerActionFactory
} from "../deployment-actions/docker-action/create-docker-deployment-action"
import { createDeploymentTestActionFactory } from "../deployment-actions/deployment-test-action/deployment-test-action"
import { createLogContextColors } from "../logging/log-context-colors"
import { TDeploymentState } from "@shepherdorg/metadata"
import { createDeploymentTimeAnnotationActionFactory } from "../deployment-actions/kubectl-action/k8s-branch-deployment/create-deployment-time-annotation-action"

export function createKubectlTestDeployAction(
  serialisedAction: TK8sDockerImageDeploymentActionStruct,
  iFakeLogging: IFakeLogging,
  fakeExec: TFakeExec,
  stateStore: TFakeStateStore
): IDockerImageKubectlDeploymentAction {
  const actionFactory = createKubectlDeploymentActionsFactory({
    exec: fakeExec,
    logger: iFakeLogging,
    stateStore: stateStore,
  })
  let deploymentState: TDeploymentState | undefined

  let testAction: IDockerImageKubectlDeploymentAction & { testInstance: boolean } = {
    getActionDeploymentState(): TDeploymentState | undefined {
      return deploymentState;
    }, setActionDeploymentState(newState: TDeploymentState | undefined): void {
      deploymentState = newState
    },
    planString() {
      return `kubectl ${serialisedAction.operation} ${serialisedAction.identifier}`
    },
    execute(deploymentOptions: TActionExecutionOptions) {
      return actionFactory.executeKubectlDeploymentAction(
        (testAction as unknown) as IKubectlDeployAction,
        deploymentOptions
      )
    },
    canRollbackExecution(): boolean {
      return false
    },
    testInstance: true,
    ...serialisedAction
  }
  return testAction
}

export function createFakeDockerDeploymentAction(
  serialisedAction: TDockerDeploymentActionStruct,
  iFakeLogging: IFakeLogging,
  fakeExec: TFakeExec,
  stateStore: TFakeStateStore
): IDockerDeploymentAction {
  let dockerActionFactory = createDockerActionFactory({
    exec: fakeExec,
    logger: iFakeLogging,
    stateStore: stateStore,
  })
  let deploymentState: TDeploymentState| undefined
  let testAction: IDockerDeploymentAction = {
    getActionDeploymentState(): TDeploymentState | undefined {
      return deploymentState;
    },
    setActionDeploymentState(newState: TDeploymentState | undefined): void {
      deploymentState = newState
    },
    planString() {
      return `test action docker run ${serialisedAction.identifier} ${serialisedAction.command}`
    },
    execute(deploymentOptions: TActionExecutionOptions) {
      return (async function(
        dockerAction: IDockerExecutableAction,
        actionExecutionOptions: TActionExecutionOptions
      ): Promise<IDockerExecutableAction> {
        return await dockerActionFactory.executeDockerAction(dockerAction, actionExecutionOptions)
      })(testAction, deploymentOptions)
    },
    canRollbackExecution(): boolean {
      return false
    },
    ...serialisedAction
  }
  return testAction
}

export function createFakeUIPusher() {
  let fakeUiDataPusher: IPushToShepherdUI & { pushedData: Array<any> }
  fakeUiDataPusher = {
    pushedData: emptyArray<any>(),
    pushDeploymentStateToUI: async (data: any) => {
      // TODOLATER Eliminate this any once we have proper type on structure pushed to UI
      fakeUiDataPusher.pushedData.push(data)
      return data
    },
  }
  return fakeUiDataPusher
}

export function createFakeDockerImageKubectlDeploymentFactory() : ICreateDockerImageKubectlDeploymentActions {
  return {
    async createKubectlDeploymentActions(_imageInfo): Promise<Array<IDockerImageKubectlDeploymentAction>>{
      console.log(`ATTEMPTING TO CREATE KUBECTL DEPLOYMENT ACTIONS THROUGH FAKE FACTORY!!!`, _imageInfo.imageDeclaration)
      return []
    }
  }
}

describe("Deployment orchestration", function() {
  let deploymentOrchestration: IDeploymentOrchestration
  let fakeStateStore: any
  let fakeExec: TFakeExec
  let fakeLogger: IFakeLogging
  let fakeUiDataPusher: IPushToShepherdUI & { pushedData: Array<any> }

  async function wrapActionIntoPlan(depAction: IAnyDeploymentAction) {
    let executionActionFactory = createDockerActionFactory({
      exec: fakeExec,
      logger: fakeLogger,
      stateStore: fakeStateStore,
    })

    let deployerActionFactory = createDockerDeployerActionFactory({logger: fakeLogger, executionActionFactory: executionActionFactory, environment: 'orchestratin-specs'})
    let deploymentTestActionFactory = createDeploymentTestActionFactory({dockerActionFactory: executionActionFactory, logger: fakeLogger})
    let dockerImageKubectlDeploymentActionFactory = createFakeDockerImageKubectlDeploymentFactory()
    let rolloutWaitActionFactory = createRolloutWaitActionFactory({
      exec: fakeExec,
      logger: fakeLogger,
      stateStore: fakeStateStore,
    })
    let fakeDeps: TDeploymentPlanDependencies = {
      deploymentEnvironment: "specenv",
      ttlAnnotationActionFactory: createDeploymentTimeAnnotationActionFactory({exec: fakeExec, logger: fakeLogger, systemTime: () => {return new Date()}, timeout: setTimeout}),
      exec: fakeExec,
      logger: fakeLogger,
      stateStore: fakeStateStore,
      uiDataPusher: fakeUiDataPusher,
      rolloutWaitActionFactory: rolloutWaitActionFactory,
      dockerImageKubectlDeploymentActionFactory: dockerImageKubectlDeploymentActionFactory,
      deployerActionFactory: deployerActionFactory,
      deploymentTestActionFactory: deploymentTestActionFactory,
      logContextColors: createLogContextColors()
    }
    let deploymentPlan = createDeploymentPlanFactory(fakeDeps).createDeploymentPlan({ key: depAction.herdKey })
    await deploymentPlan.addAction(depAction)

    return deploymentPlan
  }

  async function createK8sTestPlan(deploymentKey: string) {
    return await wrapActionIntoPlan(
      createKubectlTestDeployAction(
        TestActions.addedK8sDeployments[deploymentKey] as TK8sDockerImageDeploymentActionStruct,
        fakeLogger,
        fakeExec,
        fakeStateStore
      )
    )
  }

  async function createDeployerTestPlan(
    deploymentKey: string,
    fakeLogging: IFakeLogging,
    fakeExec1: TFakeExec,
    stateStore: TFakeStateStore
  ) {
    return await wrapActionIntoPlan(
      createFakeDockerDeploymentAction(
        TestActions.addedDockerDeployers[deploymentKey] as TDockerDeploymentActionStruct,
        fakeLogging,
        fakeExec1,
        stateStore
      )
    )
  }

  beforeEach(function() {
    fakeExec = createFakeExec()
    fakeUiDataPusher = createFakeUIPusher()
    fakeStateStore = createFakeStateStore()
    fakeLogger = createFakeLogger()
    deploymentOrchestration = DeploymentOrchestration({
      stateStore: fakeStateStore,
      cmd: fakeExec,
      logger: fakeLogger,
    })
  })

  describe("-k8s- deployment", function() {
    describe("checking state in actual run", function() {
      beforeEach(async () => {
        return deploymentOrchestration.addDeploymentPlan(
          await createK8sTestPlan("ConfigMap_www-icelandair-com-nginx-acls")
        )
      })

      it("should check state exactly once", () => {
        expect(fakeStateStore.checkedStates.length).to.equal(1)
      })
    })

    describe("dry-run", function() {
      beforeEach(async function() {
        fakeStateStore.nextState = { new: false, modified: true }
        return deploymentOrchestration
          .addDeploymentPlan(await createK8sTestPlan("ConfigMap_www-icelandair-com-nginx-acls"))
          .then(function() {
            return deploymentOrchestration
              .executePlans({
                pushToUi: false,
                waitForRollout: false,
                dryRun: true,
                dryRunOutputDir: "/tmp/",
                logContext: {}
              })
              .then(execResults => {
                // debug('execResults', execResults)
                return execResults
              })
          })
      })

      it("should not execute plan ", function() {
        expect(fakeExec.executedCommands.length).to.equal(0)
      })

      it("should not push any data to UI", () => {
        expect(fakeUiDataPusher.pushedData.length).to.equal(0)
      })
    })

    describe("unmodified", function() {
      beforeEach(async function() {
        fakeStateStore.nextState = { new: false, modified: false }
        return deploymentOrchestration
          .addDeploymentPlan(await createK8sTestPlan("ConfigMap_www-icelandair-com-nginx-acls"))
          .then(function() {
            return deploymentOrchestration.executePlans()
          })
      })

      it("should not execute anything", function() {
        expect(fakeExec.executedCommands.length).to.equal(0)
      })

      it("should not save any state", () => {
        expect(fakeStateStore.savedStates.length).to.equal(0)
      })

      it("should not push unmodified data to UI", () => {
        expect(fakeUiDataPusher.pushedData.length).to.equal(0)
      })

      it("should print plan stating no changes", function() {
        let outputLogger = createFakeLogger()
        deploymentOrchestration.printPlan(outputLogger)
        // outputLogger.printAllStatements()
        expect(outputLogger.logStatements.length).to.equal(1)
        expect(outputLogger.logStatements[0].data[0]).to.contain("No plans to do anything this time")
      })
    })

    describe("modified deployment docs with no rollout wait", function() {
      beforeEach(async function() {
        fakeStateStore.fixedTimestamp = "2019-10-31T11:03:52.381Z"
        fakeStateStore.nextState = {
          saveFailure: false,
          message: "",
        }
        fakeExec.nextResponse.success = "applied"

        return deploymentOrchestration
          .addDeploymentPlan(await createK8sTestPlan("ConfigMap_www-icelandair-com-nginx-acls"))
          .then(async () =>
            deploymentOrchestration.addDeploymentPlan(await createK8sTestPlan("Deployment_www-icelandair-com"))
          )
          .then(async () => deploymentOrchestration.addDeploymentPlan(await createK8sTestPlan("Namespace_monitors")))
          .then(() =>
            deploymentOrchestration.executePlans({
              dryRun: false,
              dryRunOutputDir: undefined,
              pushToUi: false,
              waitForRollout: false,
              logContext: {}
            })
          )
      })

      it("should execute three commands and no rollout status command", () => {
        expect(fakeExec.executedCommands.length).to.equal(3)
        expect(fakeExec.executedCommands[0].params[0]).to.equal("apply", "0")
        expect(fakeExec.executedCommands[1].params[0]).to.equal("apply", "1")
        expect(fakeExec.executedCommands[2].params[0]).to.equal("delete", "2")
      })
    })

    describe("unchanged deployment docs with rollout wait", function() {
      beforeEach(async function() {
        fakeStateStore.fixedTimestamp = "2019-10-31T11:03:52.381Z"
        fakeStateStore.nextState = {
          saveFailure: false,
          message: "",
          modified: false,
        }
        fakeExec.nextResponse.success = "done"

        return deploymentOrchestration
          .addDeploymentPlan(await createK8sTestPlan("ConfigMap_www-icelandair-com-nginx-acls"))
          .then(async () =>
            deploymentOrchestration.addDeploymentPlan(await createK8sTestPlan("Deployment_www-icelandair-com"))
          )
          .then(async () => deploymentOrchestration.addDeploymentPlan(await createK8sTestPlan("Namespace_monitors")))
          .then(() =>
            deploymentOrchestration.executePlans({
              dryRun: false,
              dryRunOutputDir: undefined,
              pushToUi: true,
              waitForRollout: true,
              logContext: {}
            })
          )
      })

      it("should not execute anything", () => {
        // Uncomment for clearer insight
        // console.log(`fakeExec.executedCommands`, fakeExec.executedCommands.map((ec:any)=> identifyDocument(ec.options.stdin).identifyingString + ' ... ' +  ec.params.join(' ')))
        expect(fakeExec.executedCommands.length).to.equal(0)
      })
    })

    describe("modified, fail to save state", function() {
      let saveError: Error

      beforeEach(async function() {
        fakeStateStore.nextState = {
          saveFailure: true,
          message: "State store failure!",
        }
        fakeExec.nextResponse.success = "applied"
        return deploymentOrchestration
          .addDeploymentPlan(await createK8sTestPlan("ConfigMap_www-icelandair-com-nginx-acls"))
          .then(async () =>
            deploymentOrchestration.addDeploymentPlan(await createK8sTestPlan("Deployment_www-icelandair-com"))
          )
          .then(async () => deploymentOrchestration.addDeploymentPlan(await createK8sTestPlan("Namespace_monitors")))
          .then(() =>
            deploymentOrchestration.executePlans().catch(function(err) {
              saveError = err
            })
          )
      })

      it("should render errors", function() {
        expect(fakeLogger.log).to.contain(
          "Failed to save state after successful kubectl deployment! testenvimage:0.0.0:kube.config.tar.base64/ConfigMap_www-icelandair-com-nginx-acls\nError: State store failure!"
        )
      })
    })

    describe("modified, delete deployment and kubectl responds with not found", function() {
      let saveError: Error, executedAction: IK8sDirDeploymentAction

      beforeEach(async function() {
        fakeExec.setErr("not found")
        return deploymentOrchestration
          .addDeploymentPlan(await createK8sTestPlan("Namespace_monitors"))
          .then(function() {
            return deploymentOrchestration
              .executePlans()
              .then(function(planResults) {
                executedAction = planResults[0].actionResults[0] as IK8sDirDeploymentAction
              })
              .catch(function(err) {
                saveError = err
              })
          })
      })

      it("should not result in error ", function() {
        // if (saveError) {
        //   console.error('Unexpected error in test!', saveError)
        // }
        expect(saveError).to.equal(undefined)
      })

      it("should save call log with state", function() {
        expect(executedAction?.getActionDeploymentState()?.stdout).to.equal(undefined)
        expect(executedAction?.getActionDeploymentState()?.stderr).to.equal("not found")
      })
    })
  })

  describe("- docker deployer planning -", function() {
    describe("basic state checking", function() {
      beforeEach(async function() {
        await deploymentOrchestration.addDeploymentPlan(
          await createDeployerTestPlan(
            "testenvimage-migrations:0.0.0",
            createFakeLogger(),
            createFakeExec(),
            createFakeStateStore()
          )
        )
      })

      it("should check state for each added docker deployer", function() {
        expect(fakeStateStore.checkedStates.length).to.equal(1)
      })
    })

    describe("executing modified parameters", function() {
      beforeEach(async function() {
        fakeExec.nextResponse.success = "this would be docker run output"
        fakeStateStore.nextState = { new: false, modified: true }
        await deploymentOrchestration.addDeploymentPlan(
          await createDeployerTestPlan("testenvimage-migrations:0.0.0", createFakeLogger(), fakeExec, fakeStateStore)
        )
        await deploymentOrchestration.addDeploymentPlan(
          await createK8sTestPlan("ConfigMap_www-icelandair-com-nginx-acls")
        )
        return deploymentOrchestration.executePlans()
      })

      it("should run docker with correct parameters", function() {
        let p = 0
        expect(fakeExec.executedCommands.length).to.equal(2)
        expect(fakeExec.executedCommands[0].command).to.equal("docker")
        expect(fakeExec.executedCommands[0].params[p++]).to.equal("run")
        expect(fakeExec.executedCommands[0].params[p++]).to.equal("-i")
        expect(fakeExec.executedCommands[0].params[p++]).to.equal("--rm")
        expect(fakeExec.executedCommands[0].params[p++]).to.equal("-e")
        expect(fakeExec.executedCommands[0].params[p++]).to.equal("ENV=testenv")
      })

      it("should print plan for modified deployments", function() {
        let outputLogger: IFakeLogging
        outputLogger = createFakeLogger()
        deploymentOrchestration.printPlan(outputLogger)

        expect(outputLogger.logStatements.length).to.equal(4)
        expect(outputLogger.logStatements[0].data[0]).to.equal("Deploying testenvimage-migrations:0.0.0")
        expect(outputLogger.logStatements[1].data[0]).to.equal(
          "  - test action docker run testenvimage-migrations:0.0.0 ls"
        )
        expect(outputLogger.logStatements[2].data[0]).to.equal("Deploying test-image")
        expect(outputLogger.logStatements[3].data[0]).to.equal(
          "  - kubectl apply ConfigMap_www-icelandair-com-nginx-acls"
        )
      })
    })

    describe("printing with no planned actions", function() {
      it("should print meaningful message", () => {
        let outputLogger = createFakeLogger()
        deploymentOrchestration.printPlan(outputLogger)
        expect(outputLogger.log).to.contain("No plans to do anything this time")
      })
    })

    describe("execution order", function() {
      beforeEach(async function() {
        fakeExec.nextResponse.success = "this would be docker run output"
        fakeStateStore.nextState = { new: false, modified: true }
        return deploymentOrchestration
          .addDeploymentPlan(
            await wrapActionIntoPlan(
              createFakeDockerDeploymentAction(
                TestActions.addedDockerDeployers["testenvimage-migrations:0.0.0"] as IDockerDeploymentAction,
                createFakeLogger(),
                createFakeExec(),
                createFakeStateStore()
              )
            )
          )
          .then(async () =>
            deploymentOrchestration.addDeploymentPlan(
              await wrapActionIntoPlan(
                createFakeDockerDeploymentAction(
                  TestActions.addedDockerDeployers["test-infrastructure:1.0.0"] as IDockerDeploymentAction,
                  createFakeLogger(),
                  createFakeExec(),
                  createFakeStateStore()
                )
              )
            )
          )
          .then(async () =>
            deploymentOrchestration.addDeploymentPlan(
              await wrapActionIntoPlan(
                createFakeDockerDeploymentAction(
                  TestActions.addedDockerDeployers["test-infrastructure:1.0.0"] as IDockerDeploymentAction,
                  createFakeLogger(),
                  createFakeExec(),
                  createFakeStateStore()
                )
              )
            )
          )
          .then(async () =>
            deploymentOrchestration.addDeploymentPlan(await createK8sTestPlan("Service_www-icelandair-com-internal"))
          )
          .then(function() {
            return deploymentOrchestration.executePlans()
          })
      })

      xit("should execute each section to completion before starting next", () => {
        // releasePlan.printPlan(console)
        // expect.fail('IMplement test')
      })
    })
  })
})
