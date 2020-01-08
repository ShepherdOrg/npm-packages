import { expect } from "chai"
import { DeploymentOrchestration } from "./deployment-orchestration"
import {
  FnDeploymentStateSave,
  IAnyDeploymentAction,
  IDockerDeploymentAction,
  IK8sDirDeploymentAction,
  IK8sDockerImageDeploymentAction,
  ILog,
  TActionExecutionOptions,
  TDeploymentOrchestration,
} from "../deployment-types"
import { executeKubectlDeploymentAction } from "../deployment-actions/kubectl-deployer/create-kubectl-deployment-action"
import { emptyArray } from "../helpers/ts-functions"
import { CreateFakeLogger, IFakeLogging } from "../test-tools/fake-logger"
import {
  TDockerDeploymentActionStruct,
  TestActions,
  TK8sDockerImageDeploymentActionStruct,
} from "../herd-loading/testdata/testActions"
import { executeDeployerAction } from "../deployment-actions/docker-deployer/docker-deployment-action"
import { createFakeExec } from "../test-tools/fake-exec"
import { createFakeStateStore } from "./fake-state-store-factory"

const k8sDeployments = TestActions.addedK8sDeployments
const dockerDeployers = TestActions.addedDockerDeployers

export function createKubectlTestDeployAction(
  serialisedAction: TK8sDockerImageDeploymentActionStruct,
): IK8sDockerImageDeploymentAction {
  let testAction = {
    execute(deploymentOptions:TActionExecutionOptions, cmd:string, logger:ILog, saveDeploymentState: FnDeploymentStateSave) {
      return executeKubectlDeploymentAction(testAction, deploymentOptions, cmd, logger, saveDeploymentState)
    },
    testInstance: true,
    ...serialisedAction
  }
  return testAction
}

export function createDockerTestDeployerAction(
  serialisedAction: TDockerDeploymentActionStruct,
): IDockerDeploymentAction {
  let testAction = {
    execute(deploymentOptions:TActionExecutionOptions, cmd:string, logger:ILog, saveDeploymentState: FnDeploymentStateSave) {
      return executeDeployerAction(testAction, deploymentOptions, cmd, logger, saveDeploymentState)
    },
    testInstance: true,
    ...serialisedAction
  }
  return testAction
}

type TExec = any

describe("Deployment orchestration", function() {
  let deploymentOrchestration: TDeploymentOrchestration
  let fakeStateStore : any
  let fakeExec : TExec
  let fakeLogger: IFakeLogging
  let fakeUiDataPusher: any

  beforeEach(function() {
    fakeUiDataPusher = {
      pushedData: emptyArray<any>(),
      pushDeploymentStateToUI: async (data:any) => { // TODO Eliminate this any once we have proper type on datastructure pushed to UI
       fakeUiDataPusher.pushedData.push(data)
        return data
      },
    }
    fakeStateStore = createFakeStateStore()
    fakeLogger = CreateFakeLogger()

    fakeExec = createFakeExec()
    deploymentOrchestration = DeploymentOrchestration({
      stateStore: fakeStateStore,
      cmd: fakeExec,
      logger: fakeLogger,
      uiDataPusher: fakeUiDataPusher,
    })("planSpecEnv")
  })

  describe("-k8s- deployment", function() {
    it("should check state for each added kubernetes deployment", function() {
      return deploymentOrchestration
        .addDeployment(createKubectlTestDeployAction(k8sDeployments["ConfigMap_www-icelandair-com-nginx-acls"] as IK8sDockerImageDeploymentAction))
        .then(function(deploymentState) {
          // @ts-ignore
          expect(deploymentState?.state?.testState).to.equal(true)
          expect(fakeStateStore.checkedStates.length).to.equal(1)
          expect(fakeStateStore.checkedStates[0].env).to.equal("planSpecEnv")
        })
    })

    describe("dry-run", function() {
      beforeEach(function() {
        fakeStateStore.nextState = { new: false, modified: true }
        return deploymentOrchestration
          .addDeployment(createKubectlTestDeployAction(k8sDeployments["ConfigMap_www-icelandair-com-nginx-acls"] as IK8sDockerImageDeploymentAction))
          .then(function() {
            return deploymentOrchestration
              .executePlan({
                pushToUi: false,
                waitForRollout: false,
                dryRun: true,
                dryRunOutputDir: "/tmp/",
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
      beforeEach(function() {
        fakeStateStore.nextState = { new: false, modified: false }
        return deploymentOrchestration
          .addDeployment(createKubectlTestDeployAction(k8sDeployments["ConfigMap_www-icelandair-com-nginx-acls"] as IK8sDockerImageDeploymentAction))
          .then(function() {
            return deploymentOrchestration.executePlan()
          })
      })

      it("should not execute anything and not store state", function() {
        expect(fakeExec.executedCommands.length).to.equal(0)
      })

      it("should push unmodified data to UI", () => {
        expect(fakeUiDataPusher.pushedData[0].deploymentState.modified).to.equal(false)
      })

      it("should print plan stating no changes", function() {
        let outputLogger = CreateFakeLogger()
        deploymentOrchestration.printPlan(outputLogger)
        expect(outputLogger.logStatements.length).to.equal(1)
        expect(outputLogger.logStatements[0].data[0]).to.contain("No modified deployments in ")
      })
    })

    describe("modified deployment docs with no rollout wait", function() {
      beforeEach(function() {
        fakeStateStore.fixedTimestamp = "2019-10-31T11:03:52.381Z"
        fakeStateStore.nextState = {
          saveFailure: false,
          message: "",
        }
        fakeExec.nextResponse.success = "applied"

        return deploymentOrchestration
          .addDeployment(createKubectlTestDeployAction(k8sDeployments["ConfigMap_www-icelandair-com-nginx-acls"] as IK8sDockerImageDeploymentAction))
          .then(() =>
            deploymentOrchestration.addDeployment(createKubectlTestDeployAction(k8sDeployments["Deployment_www-icelandair-com"] as IK8sDockerImageDeploymentAction))
          )
          .then(() => deploymentOrchestration.addDeployment(createKubectlTestDeployAction(k8sDeployments["Namespace_monitors"] as IK8sDockerImageDeploymentAction)))
          .then(() =>
            deploymentOrchestration.executePlan({
              dryRun: false,
              dryRunOutputDir: undefined,
              pushToUi: false,
              waitForRollout: false,
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

    describe("modified deployment docs with rollout wait", function() {
      beforeEach(function() {
        fakeStateStore.fixedTimestamp = "2019-10-31T11:03:52.381Z"
        fakeStateStore.nextState = {
          saveFailure: false,
          message: "",
        }
        fakeExec.nextResponse.success = "applied"

        return deploymentOrchestration
          .addDeployment(createKubectlTestDeployAction(k8sDeployments["ConfigMap_www-icelandair-com-nginx-acls"] as IK8sDockerImageDeploymentAction))
          .then(() =>
            deploymentOrchestration.addDeployment(createKubectlTestDeployAction(k8sDeployments["Deployment_www-icelandair-com"] as IK8sDockerImageDeploymentAction))
          )
          .then(() => deploymentOrchestration.addDeployment(createKubectlTestDeployAction(k8sDeployments["Namespace_monitors"] as IK8sDockerImageDeploymentAction)))
          .then(() =>
            deploymentOrchestration.executePlan({
              dryRun: false,
              dryRunOutputDir: undefined,
              pushToUi: true,
              waitForRollout: true,
            })
          )
      })

      it("should execute two apply, one delete and a rollout status command", () => {
        let idx = 0
        // Uncomment for clearer insight  console.log(`fakeExec.executedCommands`, fakeExec.executedCommands.map((ec:any)=> identifyDocument(ec.options.stdin).identifyingString + ' ... ' +  ec.params.join(' ')))
        expect(fakeExec.executedCommands.length).to.equal(4)
        expect(fakeExec.executedCommands[idx++].params[0]).to.equal("apply", "configmap")
        expect(fakeExec.executedCommands[idx++].params[0]).to.equal("apply", "deployment")
        expect(fakeExec.executedCommands[idx++].params[0]).to.equal("rollout", "wait for deployment")
        expect(fakeExec.executedCommands[idx++].params[0]).to.equal("delete", "delete namespace monitors")
      })

      it("should execute kubectl apply for all deployments with same origin", function() {
        expect(fakeExec.executedCommands[0].command).to.equal("kubectl")
        expect(fakeExec.executedCommands[0].params[0]).to.equal("apply")
        expect(fakeExec.executedCommands[0].params[1]).to.equal("-f")
        expect(fakeExec.executedCommands[0].params[2]).to.equal("-")
        expect(fakeExec.executedCommands[0].options.stdin).to.contain("name: www-icelandair-com-nginx-acls")
      })

      it("should execute kubectl rollout status to wait for deployment to complete", () => {
        expect(fakeExec.executedCommands[3].command).to.equal("kubectl")
        expect(fakeExec.executedCommands[3].params[0]).to.equal("rollout")
        expect(fakeExec.executedCommands[3].params[1]).to.equal("status")
        expect(fakeExec.executedCommands[3].params[2]).to.equal("Deployment/www-icelandair-com-test1")
      })

      it("should push data to UI", () => {
        expect(fakeUiDataPusher.pushedData.length).to.equal(3)

        expect(fakeUiDataPusher.pushedData[0].displayName).to.equal("monitors-namespace.yml", 'zero')

        expect(fakeUiDataPusher.pushedData[1].displayName).to.equal("Testimage", 'one')
        expect(fakeUiDataPusher.pushedData[1].deploymentState.timestamp).to.eql(new Date("2019-10-31T11:03:52.381Z"))

        expect(fakeUiDataPusher.pushedData[2].displayName).to.equal("Testimage", 'two')
      })

      it("should store state kubectl", function() {
        expect(fakeStateStore.savedStates.length).to.equal(3)

        // expect(fakeStateStore.savedStates[0].origin).to.equal(k8sDeployments.Namespace_monitors.origin);
        expect(fakeStateStore.savedStates[0].origin).to.equal(
          k8sDeployments["ConfigMap_www-icelandair-com-nginx-acls"].origin
        )
        // expect(fakeStateStore.savedStates[1].origin).to.equal(k8sDeployments["Deployment_www-icelandair-com"].origin);
      })

      it("should log deployments", function() {
        expect(fakeLogger.logStatements.map(logs => logs.data[0]).join(" ")).to.equal(
          "kubectl apply deployments in testenvimage:0.0.0:kube.config.tar.base64/ConfigMap_www-icelandair-com-nginx-acls applied kubectl apply deployments in testenvimage:0.0.0:kube.config.tar.base64/Deployment_www-icelandair-com applied kubectl delete deployments in /Users/gulli/src/github.com/shepherd/npm-packages/packages/deployer/src/deployment-manager/testdata/happypath/namespaces/Namespace_monitors applied Deployment/www-icelandair-com-test1 rolled out"
        )
        expect(fakeLogger.logStatements.length).to.equal(7)
      })

      it("should log rollout complete", () => {
        expect(fakeLogger.logStatements.map(logs => logs.data[0]).join(" ")).to.contain(
          "Deployment/www-icelandair-com-test1 rolled out"
        )
      })
    })

    describe("modified, fail to save state", function() {
      let saveError: Error

      beforeEach(function() {
        fakeStateStore.nextState = {
          saveFailure: true,
          message: "State store failure!",
        }
        fakeExec.nextResponse.success = "applied"
        return deploymentOrchestration
          .addDeployment(createKubectlTestDeployAction(k8sDeployments["ConfigMap_www-icelandair-com-nginx-acls"] as IK8sDockerImageDeploymentAction))
          .then(() =>
            deploymentOrchestration.addDeployment(createKubectlTestDeployAction(k8sDeployments["Deployment_www-icelandair-com"] as IK8sDockerImageDeploymentAction))
          )
          .then(() => deploymentOrchestration.addDeployment(createKubectlTestDeployAction(k8sDeployments["Namespace_monitors"] as IK8sDockerImageDeploymentAction)))
          .then(() =>
            deploymentOrchestration.executePlan().catch(function(err) {
              saveError = err
            })
          )
      })

      it("should propagate error to caller", function() {
        expect(saveError.message).to.equal(
          "Failed to save state after successful kubectl deployment! testenvimage:0.0.0:kube.config.tar.base64/ConfigMap_www-icelandair-com-nginx-acls\nError: State store failure!"
        )
      })
    })

    describe("modified, delete deployment and kubectl responds with not found", function() {
      let saveError:Error, executedAction: IK8sDirDeploymentAction

      beforeEach(function() {
        fakeExec.nextResponse.err = "not found"
        return deploymentOrchestration
          .addDeployment(createKubectlTestDeployAction(k8sDeployments["Namespace_monitors"] as IK8sDockerImageDeploymentAction))
          .then(function() {
            return deploymentOrchestration
              .executePlan()
              .then(function(executionResults) {
                executedAction = executionResults[0] as IK8sDirDeploymentAction
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
        expect(executedAction?.state?.stdout).to.equal(undefined)
        expect(executedAction?.state?.stderr).to.equal("not found")
      })
    })
  })

  describe("- docker deployer planning -", function() {
    describe("basic state checking", function() {
      let deploymentState : IAnyDeploymentAction

      beforeEach(function() {
        return deploymentOrchestration.addDeployment(dockerDeployers["testenvimage-migrations:0.0.0"] as IK8sDockerImageDeploymentAction).then(function(ds) {
          deploymentState = ds
        })
      })

      it("should check state for each added docker deployer", function() {
        // @ts-ignore testState
        expect(deploymentState.state.testState).to.equal(true)
        expect(fakeStateStore.checkedStates.length).to.equal(1)
      })

    })

    describe("modified parameters", function() {
      beforeEach(function() {
        fakeExec.nextResponse.success = "this would be docker run output"
        fakeStateStore.nextState = { new: false, modified: true }
        return deploymentOrchestration.addDeployment(createDockerTestDeployerAction(dockerDeployers["testenvimage-migrations:0.0.0"] as TDockerDeploymentActionStruct)).then(function() {
          return deploymentOrchestration.executePlan()
        })
      })

      it("should run docker with correct parameters", function() {
        let p = 0
        expect(fakeExec.executedCommands.length).to.equal(1)
        expect(fakeExec.executedCommands[0].command).to.equal("docker")
        expect(fakeExec.executedCommands[0].params[p++]).to.equal("run")
        expect(fakeExec.executedCommands[0].params[p++]).to.equal("-i")
        expect(fakeExec.executedCommands[0].params[p++]).to.equal("--rm")
        expect(fakeExec.executedCommands[0].params[p++]).to.equal("-e")
        expect(fakeExec.executedCommands[0].params[p++]).to.equal("ENV=testenv")
      })

      it("should print info about modified deployments", function() {
        let outputLogger = CreateFakeLogger()

        deploymentOrchestration.printPlan(outputLogger)
        expect(outputLogger.logStatements.length).to.equal(2)
        expect(outputLogger.logStatements[0].data[0]).to.equal("Running testenvimage-migrations:0.0.0 deployer")
        expect(outputLogger.logStatements[1].data[0]).to.equal("  -  docker run testenvimage-migrations:0.0.0 ls")
      })
    })

    describe("deployment order", function() {
      beforeEach(function() {
        fakeExec.nextResponse.success = "this would be docker run output"
        fakeStateStore.nextState = { new: false, modified: true }
        return deploymentOrchestration.addDeployment(createDockerTestDeployerAction(dockerDeployers["testenvimage-migrations:0.0.0"] as IDockerDeploymentAction))
          .then(()=>deploymentOrchestration.addDeployment(createDockerTestDeployerAction(dockerDeployers["test-infrastructure:1.0.0"] as IDockerDeploymentAction)))
          .then(()=>deploymentOrchestration.addDeployment(createDockerTestDeployerAction(dockerDeployers["test-infrastructure:1.0.0"] as IDockerDeploymentAction)))
          .then(()=>deploymentOrchestration.addDeployment(createKubectlTestDeployAction(k8sDeployments["Service_www-icelandair-com-internal"] as IK8sDockerImageDeploymentAction)))
          .then(function() {
          return deploymentOrchestration.executePlan()
        })
      })

      xit("should execute each section to completion before starting next", () => {

        // releasePlan.printPlan(console)
        // expect.fail('IMplement test')
      })

    })
  })
})
