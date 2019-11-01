const ReleasePlanModule = require("./release-plan")
const FakeExec = require("../test-tools/fake-exec.js")
const FakeLogger = require("../test-tools/fake-logger.js")

const inject = require("@shepherdorg/nano-inject").inject
const _ = require("lodash")
const expect = require("chai").expect

const fs = require("fs")

const k8sDeployments = require('./testdata/testplan.json').addedK8sDeployments
const dockerDeployers = require('./testdata/testplan.json').addedDockerDeployers

describe("Release plan", function() {
  let releasePlan, checkedStates
  let fakeStateStore
  let fakeExec
  let fakeLogger
  let fakeUiDataPusher


  beforeEach(function() {
    checkedStates = []
    fakeUiDataPusher={
      pushedData:[],
      pushDeploymentStateToUI:async (data)=>{
        fakeUiDataPusher.pushedData.push(data)
        return data
      }
    }
    fakeStateStore = {
      fixedTimestamp: "2001-01-10T00:00:00.000Z",
      nextState: {},
      savedStates: [],
      getDeploymentState: function(deployment) {
        checkedStates.push(JSON.parse(JSON.stringify(deployment)))
        return Promise.resolve(
          _.extend(
            {
              testState: true,
              new: true,
              modified: true,
              operation: "apply",
              version: "0.0.0",
              lastVersion: undefined,
              signature: "fakesignature",
              origin: deployment.origin,
              env: "UNITTEST",
              timestamp: fakeStateStore.fixedTimestamp
            },
            fakeStateStore.nextState
          )
        )
      },
      saveDeploymentState: function(deploymentState) {
        return new Promise(function(resolve, reject) {
          if (fakeStateStore.nextState.saveFailure) {
            reject(fakeStateStore.nextState.message)
            return
          }

          fakeStateStore.savedStates.push(deploymentState)
          resolve(deploymentState)
        })
      },
    }
    fakeLogger = FakeLogger()

    fakeExec = FakeExec()
    releasePlan = ReleasePlanModule(
      inject({
        stateStore: fakeStateStore,
        cmd: fakeExec,
        logger: fakeLogger,
        uiDataPusher: fakeUiDataPusher
      })
    )("planSpecEnv")
  })

  describe("-k8s- deployment", function() {
    it("should check state for each added kubernetes deployment", function() {
      return releasePlan
        .addDeployment(
          k8sDeployments["ConfigMap_www-icelandair-com-nginx-acls"]
        )
        .then(function(deploymentState) {
          expect(deploymentState.state.testState).to.equal(true)
          expect(checkedStates.length).to.equal(1)
          expect(checkedStates[0].env).to.equal("planSpecEnv")
        })
    })

    describe("dry-run", function() {
      beforeEach(function() {
        fakeStateStore.nextState = { new: false, modified: true }
        return releasePlan
          .addDeployment(
            k8sDeployments["ConfigMap_www-icelandair-com-nginx-acls"]
          )
          .then(function(deployment) {
            return releasePlan.executePlan({
              dryRun: true,
              dryRunOutputDir: "/tmp/",
            }).then((execResults)=>{
              // debug('execResults', execResults)
              return execResults
            })
          })
      })

      it("should not execute plan ", function() {
        expect(fakeExec.executedCommands.length).to.equal(0)
      })

      it("should not push any data to UI", () => {
        expect(true).to.equal(false)
      })
    })

    describe("unmodified", function() {
      beforeEach(function() {
        fakeStateStore.nextState = { new: false, modified: false }
        return releasePlan
          .addDeployment(
            k8sDeployments["ConfigMap_www-icelandair-com-nginx-acls"]
          )
          .then(function(deploymentState) {
            return releasePlan.executePlan()
          })
      })

      it("should not execute anything and not store state", function() {
        expect(fakeExec.executedCommands.length).to.equal(0)
      })

      it("should not push any data to UI", () => {
        expect(true).to.equal(false)
      })

      it("should print plan stating no changes", function() {
        let outputLogger = new FakeLogger()
        releasePlan.printPlan(outputLogger)
        expect(outputLogger.logStatements.length).to.equal(1)
        expect(outputLogger.logStatements[0].data[0]).to.contain(
          "No modified deployments in "
        )
      })
    })

    describe.only("modified deployment docs", function() {
      beforeEach(function() {
        fakeStateStore.fixedTimestamp = "2019-10-31T11:03:52.381Z"
        fakeExec.nextResponse.success = "applied"
        return releasePlan
          .addDeployment(
            k8sDeployments["ConfigMap_www-icelandair-com-nginx-acls"]
          )
          .then(
            releasePlan.addDeployment(
              k8sDeployments["Deployment_www-icelandair-com"]
            )
          )
          .then(releasePlan.addDeployment(k8sDeployments["Namespace_monitors"]))
          .then(function(deploymentState) {
            return releasePlan.executePlan()
          })
      })

      it("should execute kubectl apply for all deployments with same origin", function() {
        expect(fakeExec.executedCommands.length).to.equal(3)
        expect(fakeExec.executedCommands[0].command).to.equal("kubectl")
        expect(fakeExec.executedCommands[0].params[0]).to.equal("apply")
        expect(fakeExec.executedCommands[0].params[1]).to.equal("-f")
        expect(fakeExec.executedCommands[0].params[2]).to.equal("-")
        expect(fakeExec.executedCommands[0].options.stdin).to.contain(
          "name: www-icelandair-com-nginx-acls"
        )
      })

      it("should push data to UI", () => {

        // testDebug('WROTE DATA ARRAY TO ' )
        // fs.writeFileSync('./pushedDataArray.json', JSON.stringify(fakeUiDataPusher.pushedData))
        expect(fakeUiDataPusher.pushedData.length).to.equal(3)

        expect(fakeUiDataPusher.pushedData[0].displayName).to.equal('Testimage')
        expect(fakeUiDataPusher.pushedData[1].displayName).to.equal('Testimage')
        expect(fakeUiDataPusher.pushedData[2].displayName).to.equal('monitors-namespace.yml')
        expect(fakeUiDataPusher.pushedData[2].deploymentState.timestamp).to.eql(new Date('2019-10-31T11:03:52.381Z'))


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
        // 3 statements for each deployment
        expect(fakeLogger.logStatements.length).to.equal(9)
      })

      // it.only("should print info about modified deployments", function() {
      //   let outputLogger = new FakeLogger()
      //   releasePlan.printPlan(console)
      //   releasePlan.printPlan(outputLogger)
      //   expect(outputLogger.logStatements.length).to.equal(5)
      //   expect(outputLogger.logStatements[0].data[0]).to.equal(
      //     "From test-image"
      //   )
      //   expect(outputLogger.logStatements[1].data[0]).to.equal(
      //     "  -  will apply ConfigMap_www-icelandair-com-nginx-acls"
      //   )
      //   expect(outputLogger.logStatements[2].data[0]).to.equal(
      //     "  -  will apply Deployment_www-icelandair-com"
      //   )
      //   expect(outputLogger.logStatements[3].data[0]).to.equal(
      //     "From kube-config:namespaces"
      //   )
      //   expect(outputLogger.logStatements[4].data[0]).to.equal(
      //     "  -  will delete Namespace_monitors"
      //   )
      // })
    })

    describe("modified, fail to save state", function() {
      let saveError

      beforeEach(function() {
        fakeStateStore.nextState = {
          saveFailure: true,
          message: "State store failure!",
        }
        fakeExec.nextResponse.success = "applied"
        return releasePlan
          .addDeployment(
            k8sDeployments["ConfigMap_www-icelandair-com-nginx-acls"]
          )
          .then(
            releasePlan.addDeployment(
              k8sDeployments["Deployment_www-icelandair-com"]
            )
          )
          .then(releasePlan.addDeployment(k8sDeployments["Namespace_monitors"]))
          .then(function(deploymentState) {
            return releasePlan.executePlan().catch(function(err) {
              saveError = err
            })
          })
      })

      it("should propagate error to caller", function() {
        expect(saveError).to.equal(
          "Failed to save state after successful deployment! testenvimage:0.0.0:kube.config.tar.base64/ConfigMap_www-icelandair-com-nginx-acls\nState store failure!"
        )
      })
    })

    describe("modified, delete deployment and kubectl responds with not found", function() {
      let saveError, executedPlan, deploymentState

      beforeEach(function() {
        fakeExec.nextResponse.err = "not found"
        return releasePlan
          .addDeployment(k8sDeployments["Namespace_monitors"])
          .then(function(_deploymentState) {
            deploymentState = _deploymentState
            return releasePlan
              .executePlan()
              .then(function(executionResults) {
                executedPlan = executionResults[0]
              })
              .catch(function(err) {
                saveError = err
              })
          })
      })

      it("should not result in error ", function() {
        if (saveError) {
          console.error(saveError)
        }
        expect(saveError).to.equal(undefined)
      })

      it("should save call log with state", function() {
        expect(executedPlan.state.stdout).to.equal(undefined)
        expect(executedPlan.state.stderr).to.equal("not found")
      })
    })
  })

  describe("- docker deployer -", function() {
    describe("basic state checking", function() {
      let deploymentState

      beforeEach(function() {
        return releasePlan
          .addDeployment(dockerDeployers["testenvimage-migrations:0.0.0"])
          .then(function(ds) {
            deploymentState = ds
          })
      })

      it("should check state for each added docker deployer", function() {
        expect(deploymentState.state.testState).to.equal(true)
        expect(checkedStates.length).to.equal(1)
      })

      it("should use expanded docker parameter list as deployment descriptor for state checking", function() {
        expect(checkedStates[0].descriptor).to.equal(
          "-i --rm -e ENV=testenv -e DB_HOST=testing123 -e DB_PASS=testing123 -e THIS_IS_DEPLOYER_ONE=true testenvimage-migrations:0.0.0"
        )
      })
    })

    describe("modified parameters", function() {
      let deployment

      beforeEach(function() {
        fakeExec.nextResponse.success = "this would be docker run output"
        fakeStateStore.nextState = { new: false, modified: true }
        return releasePlan
          .addDeployment(dockerDeployers["testenvimage-migrations:0.0.0"])
          .then(function(ds) {
            deployment = ds
            return releasePlan.executePlan()
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
        expect(fakeExec.executedCommands[0].params[p++]).to.equal(
          "ENV=testenv"
        )
      })

      it("should print info about modified deployments", function() {
        let outputLogger = new FakeLogger()

        releasePlan.printPlan(outputLogger)
        expect(outputLogger.logStatements.length).to.equal(2)
        expect(outputLogger.logStatements[0].data[0]).to.equal(
          "testenvimage-migrations:0.0.0 deployer"
        )
        expect(outputLogger.logStatements[1].data[0]).to.equal(
          "  -  will run testenvimage-migrations:0.0.0 ls"
        )
      })
    })
  })
})
