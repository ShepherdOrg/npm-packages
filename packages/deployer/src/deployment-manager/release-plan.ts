import * as path from "path"

import { emptyArray } from "../helpers/ts-functions"
import { extendedExec, writeFile } from "../promisified"
import {
  ILog,
  TActionExecutionOptions,
  TDeploymentPlan,
  TDockerDeploymentAction,
  TK8sDeploymentPlan,
  TK8sDirDeploymentAction,
  TK8sDockerImageDeploymentAction,
  TKubectlDeployAction,
  TReleasePlanDependencies,
} from "./deployment-types"
import { mapUntypedDeploymentData } from "../map-untyped-deployment-data"
import { TFileSystemPath } from "../basic-types"
import { Oops } from "oops-error"
import Bluebird = require("bluebird")

// function writeJsonToFile (path1 = "./shepherd-pushed.json") {
//   return shepherdMetadata => {
//     fs.writeFile(path1, JSON.stringify(shepherdMetadata), ()=>{
//       console.info('WROTE JSON TO ' + path1)
//     })
//     return shepherdMetadata
//   }
// }

type TK8sDeploymentActionMap = { [key: string]: any }
type TDockerDeploymentPlan = { [key: string]: any }

export interface TReleasePlan {
  executePlan: (runOptions?: TActionExecutionOptions) => Promise<Array<(TDockerDeploymentAction | TKubectlDeployAction | undefined)>>
  printPlan: (logger: ILog) => void
  exportDeploymentDocuments: (exportDirectory: TFileSystemPath) => Promise<unknown>
  addDeployment:(deploymentAction: (TDockerDeploymentAction | TK8sDockerImageDeploymentAction))=> Promise<TDockerDeploymentAction | TK8sDockerImageDeploymentAction>
}


export function ReleasePlanModule(injected: TReleasePlanDependencies) {
  const stateStore = injected.stateStore
  const cmd = injected.cmd
  const logger = injected.logger
  const uiDataPusher = injected.uiDataPusher

  return function(forEnv: string): TReleasePlan {
    if (!forEnv) {
      throw new Error("must specify environment you are creating a deployment plan for")
    }

    const k8sDeploymentActions: TK8sDeploymentActionMap = {}
    const dockerDeploymentPlan: TDockerDeploymentPlan = {}
    const k8sDeploymentsByIdentifier: { [key: string]: TK8sDockerImageDeploymentAction } = {}

    function addK8sDeployment(deploymentAction: TK8sDockerImageDeploymentAction) {
      k8sDeploymentActions[deploymentAction.origin] = k8sDeploymentActions[deploymentAction.origin] || {
        herdKey: deploymentAction.herdKey,
        deployments: [],
      }
      k8sDeploymentActions[deploymentAction.origin].deployments.push(deploymentAction)

      if (k8sDeploymentsByIdentifier[deploymentAction.identifier]) {
        throw new Error(
          deploymentAction.identifier +
          " is already in deployment plan from " +
          k8sDeploymentsByIdentifier[deploymentAction.identifier].origin +
          ". When adding deployment from " +
          deploymentAction.origin,
        )
      }

      k8sDeploymentsByIdentifier[deploymentAction.identifier] = deploymentAction
    }

    function addDockerDeployer(deployment: TDockerDeploymentAction) {
      dockerDeploymentPlan[deployment.origin] = dockerDeploymentPlan[deployment.origin] || {
        herdKey: deployment.herdKey,
        deployments: [],
      }

      function allButImageParameter(params: string[]) {
        return params.slice(0, params.length - 1)
      }

      deployment.descriptor = allButImageParameter(deployment.dockerParameters).join(" ")
      dockerDeploymentPlan[deployment.origin].deployments.push(deployment)
    }

    function saveDeploymentState(deployment: TK8sDockerImageDeploymentAction | TDockerDeploymentAction | TK8sDirDeploymentAction) {
      if (!deployment.state) {
        throw new Oops({ message: "State is mandatory here", category: "ProgrammerError" })
      }
      return stateStore.saveDeploymentState(deployment.state)
    }

    async function addToPlanAndGetDeploymentStateFromStore(
      deploymentAction: TDockerDeploymentAction | TK8sDockerImageDeploymentAction,
    ): Promise<TDockerDeploymentAction | TK8sDockerImageDeploymentAction> {
      if (!deploymentAction.type) {
        let message = "Illegal deployment, no deployment type attribute in " + JSON.stringify(deploymentAction)
        throw new Error(message)
      }
      if (!deploymentAction.identifier) {
        let message = "Illegal deployment, no identifier attribute in " + JSON.stringify(deploymentAction)
        throw new Error(message)
      }

      deploymentAction.state = await stateStore.getDeploymentState(deploymentAction)

      if (deploymentAction.type === "k8s") {
        addK8sDeployment(deploymentAction as TK8sDockerImageDeploymentAction)
      } else if (deploymentAction.type === "deployer") {
        addDockerDeployer(deploymentAction as TDockerDeploymentAction)
      }
      return deploymentAction
    }

    function K8sDeploymentPromises(deploymentOptions: TActionExecutionOptions): Array<Promise<TKubectlDeployAction>> {
      return Object.values(k8sDeploymentActions).flatMap((k8sContainerDeployment: TDeploymentPlan) => {
        return k8sContainerDeployment.deployments.map(async (k8sDeploymentAction: TKubectlDeployAction) => {
          await k8sDeploymentAction.execute(deploymentOptions, cmd, logger, saveDeploymentState)
          return k8sDeploymentAction
        })
      })
    }

    function DeployerPromises(deploymentOptions: TActionExecutionOptions): Array<Promise<TDockerDeploymentAction | undefined>> {
      return Object.values(dockerDeploymentPlan).flatMap((deploymentPlan: TDeploymentPlan) => {
        return deploymentPlan.deployments.map(async (deployment: TDockerDeploymentAction) => {
          if (deployment.state?.modified) {
            if (deploymentOptions.dryRun && deploymentOptions.dryRunOutputDir) {
              let writePath = path.join(
                deploymentOptions.dryRunOutputDir,
                deployment.imageWithoutTag?.replace(/\//g, "_") + "-deployer.txt",
              )

              let cmdLine = `docker run ${deployment.forTestParameters?.join(" ")}`

              await writeFile(writePath, cmdLine)
              return deployment
            } else {
              try {
                const stdout = await extendedExec(cmd)("docker", ["run"].concat(deployment.dockerParameters), {
                  env: process.env,
                })
                try {
                  // logger.enterDeployment(deployment.origin + '/' + deployment.identifier);
                  logger.info(stdout)
                  // logger.exitDeployment(deployment.origin + '/' + deployment.identifier);

                  try {
                    const state = await saveDeploymentState(deployment)
                    deployment.state = state
                    return deployment
                  } catch (err) {
                    throw "Failed to save state after successful deployment! " +
                    deployment.origin +
                    "/" +
                    deployment.identifier +
                    "\n" +
                    err
                  }
                } catch (e) {
                  console.error("Error running docker run" + JSON.stringify(deployment))
                  throw e
                }
              } catch (err) {
                let message = "Failed to run docker deployer " + JSON.stringify(deployment)
                message += err
                throw message
              }
            }
          } else {
            return undefined
          }
        })
      })
    }

    async function mapDeploymentDataAndPush(deploymentData: TDockerDeploymentAction | TK8sDockerImageDeploymentAction | undefined) {
      if (!deploymentData) {
        return deploymentData
      } else {
        const mappedData = mapUntypedDeploymentData(deploymentData)
        uiDataPusher && (await uiDataPusher.pushDeploymentStateToUI(mappedData))
        return deploymentData
      }
    }

    function mapDeploymentDataAndWriteTo(dryrunOutputDir: TFileSystemPath) {
      return async (deploymentData: TDockerDeploymentAction | TK8sDockerImageDeploymentAction | undefined) => {
        if (!deploymentData) {
          return deploymentData
        } else {
          const mappedData = mapUntypedDeploymentData(deploymentData)
          const writePath = path.join(dryrunOutputDir, `send-to-ui-${mappedData?.deploymentState.key}.json`)
          await writeFile(writePath, JSON.stringify(deploymentData, null, 2))
          return deploymentData
        }
      }
    }

    async function executePlan(
      runOptions: TActionExecutionOptions = {
        dryRun: false,
        dryRunOutputDir: undefined,
        pushToUi: true,
        waitForRollout: false,
      },
    ) {
      // let i = 0
      let deploymentPromises: Array<Promise<TDockerDeploymentAction | TKubectlDeployAction | undefined>> = K8sDeploymentPromises(runOptions)

      let deployerPromises = DeployerPromises(runOptions)
      let allPromises = deploymentPromises.concat(deployerPromises)

      deploymentPromises = allPromises.map(promise => {
        if (runOptions.pushToUi) {
          if (runOptions.dryRun) {
            if (!runOptions.dryRunOutputDir) {
              throw new Oops({
                message: "dryRun and dryRunOutputDir must be specified together",
                category: "OperationalError",
              })
            } else {
              return promise.then(mapDeploymentDataAndWriteTo(runOptions.dryRunOutputDir))
            }
          } else {
            return promise.then(mapDeploymentDataAndPush)
          }
        } else {
          return promise.then()
        }
      })

      // console.info('deploymentPromises', deploymentPromises)

      const deployments = await Bluebird.all(deploymentPromises)
      // deployments.forEach((deployment)=>{
      //   runOptions.uiBackend(deployment)
      // })
      // console.info('deployments', deployments)
      return deployments
    }

    function printPlan(logger: ILog) {
      Object.entries(k8sDeploymentActions as TK8sDeploymentPlan).forEach(([_key, plan]) => {
        let modified = false
        if (plan.deployments) {
          plan.deployments.forEach(function(deployment: TK8sDockerImageDeploymentAction) {
            if (!deployment.state) {
              throw new Error("No state!")
            }
            if (deployment.state.modified) {
              if (!modified) {
                if (plan.herdKey) {
                  logger.info(`From ${plan.herdKey}`)
                } else {
                  logger.info("Missing herdKey for ", plan)
                }
              }
              modified = true
              logger.info(`  -  will ${deployment.operation} ${deployment.identifier}`)
            }
          })
        }
        if (!modified) {
          logger.info("No modified deployments in " + plan.herdKey)
        }
      })
      Object.entries(dockerDeploymentPlan as TDockerDeploymentPlan).forEach(([_key, plan]) => {
        let modified = false

        if (plan.deployments) {
          plan.deployments.forEach(function(deployment: TDockerDeploymentAction) {
            if (!deployment.state) {
              throw new Error("No state!")
            }
            if (deployment.state.modified) {
              logger.info(`${plan.herdKey} deployer`)
              logger.info(`  -  will run ${deployment.identifier} ${deployment.command}`)
              modified = true
            }
          })
        }
        if (!modified) {
          logger.info("No modifications to " + plan.herdKey)
        }
      })
    }

    function exportDeploymentDocuments(exportDirectory: TFileSystemPath):Promise<unknown> {
      return new Promise(function(resolve, reject) {
        let fileWrites = emptyArray<any>()

        Object.entries(k8sDeploymentActions as TK8sDeploymentPlan).forEach(function([_key, plan]) {
          plan.deployments.forEach(function(deployment: TK8sDockerImageDeploymentAction) {
            let writePath = path.join(
              exportDirectory,
              deployment.operation + "-" + deployment.identifier.toLowerCase() + ".yaml",
            )
            let writePromise = writeFile(writePath, deployment.descriptor.trim())
            fileWrites.push(writePromise)
          })
        })
        Object.entries(dockerDeploymentPlan as TDockerDeploymentPlan).forEach(function([_key, plan]) {
          plan.deployments.forEach(function(deploymentAction: TDockerDeploymentAction) {
            if (!deploymentAction.forTestParameters) {
              throw new Error("Missing forTestParameters!")
            }
            if (!deploymentAction.imageWithoutTag) {
              throw new Error("Missing forTestParameters!")
            }
            let cmdLine = `docker run ${deploymentAction.forTestParameters.join(" ")}`

            let writePath = path.join(
              exportDirectory,
              deploymentAction.imageWithoutTag.replace(/\//g, "_") + "-deployer.txt",
            )
            let writePromise = writeFile(writePath, cmdLine)
            fileWrites.push(writePromise)
          })
        })
        Promise.all(fileWrites)
          .then(resolve)
          .catch(reject)
      })
    }

    let myplan = {
      async addDeployment(deploymentAction: TDockerDeploymentAction | TK8sDockerImageDeploymentAction) {
        deploymentAction.env = forEnv
        return await addToPlanAndGetDeploymentStateFromStore(deploymentAction)
      },
      executePlan: executePlan,
      printPlan: printPlan,
      exportDeploymentDocuments: exportDeploymentDocuments,
    }
    return myplan
  }
}
