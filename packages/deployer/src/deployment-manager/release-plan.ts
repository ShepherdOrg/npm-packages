import * as path from "path"

import { emptyArray } from "../helpers/ts-functions"
import { extendedExec, writeFile } from "../promisified"

const mapUntypedDeploymentData = require("@shepherdorg/metadata/dist/map-untyped-deployment-data").mapUntypedDeploymentData

import Bluebird = require("bluebird")
import { TKubectrlDeployAction } from "./kubectl-deployer/create-kubectl-deployment-action"
import { ILog } from "./deployment-types"

declare var Promise: Bluebird<any>

// function writeJsonToFile (path1 = "./shepherd-pushed.json") {
//   return shepherdMetadata => {
//     fs.writeFile(path1, JSON.stringify(shepherdMetadata), ()=>{
//       console.info('WROTE JSON TO ' + path1)
//     })
//     return shepherdMetadata
//   }
// }

type TDeploymentPlan = any

type TK8sDeploymentPlan = [string, any]

type TDockerDeploymentPlan = [string, any]

export interface TActionExecutionOptions {
  forcePush: boolean
  dryRun: boolean
  dryRunOutputDir: string | undefined
}

export type TReleasePlanDependencies = {
  stateStore: any
  cmd: any
  logger: ILog
  uiDataPusher: any
}

export function ReleasePlanModule(injected : TReleasePlanDependencies) {
  const stateStore = injected.stateStore
  const cmd = injected.cmd
  const logger = injected.logger
  const uiDataPusher = injected.uiDataPusher

  return function(forEnv) {
    if (!forEnv) {
      throw new Error("must specify environment you are creating a deployment plan for")
    }

    const k8sDeploymentActions = {}
    const dockerDeploymentPlan = {}
    const k8sDeploymentsByIdentifier = {}

    function addK8sDeployment(deployment) {
      k8sDeploymentActions[deployment.origin] = k8sDeploymentActions[deployment.origin] || {
        herdKey: deployment.herdKey,
        deployments: [],
      }
      k8sDeploymentActions[deployment.origin].deployments.push(deployment)

      if (k8sDeploymentsByIdentifier[deployment.identifier]) {
        throw new Error(
          deployment.identifier +
          " is already in deployment plan from " +
          k8sDeploymentsByIdentifier[deployment.identifier].origin +
          ". When adding deployment from " +
          deployment.origin,
        )
      }

      k8sDeploymentsByIdentifier[deployment.identifier] = deployment
    }

    function addDockerDeployer(deployment) {
      dockerDeploymentPlan[deployment.origin] = dockerDeploymentPlan[deployment.origin] || {
        herdKey: deployment.herdKey,
        deployments: [],
      }

      function allButImageParameter(params) {
        return params.slice(0, params.length - 1)
      }

      deployment.descriptor = allButImageParameter(deployment.dockerParameters).join(" ")
      dockerDeploymentPlan[deployment.origin].deployments.push(deployment)
    }

    function saveDeploymentState(deployment) {
      return stateStore.saveDeploymentState(deployment.state)
    }

    async function addToPlanAndGetDeploymentStateFromStore(deploymentAction): Promise<TKubectrlDeployAction> {
      let state = await stateStore.getDeploymentState(deploymentAction)

      if (!deploymentAction.type) {
        let message = "Illegal deployment, no deployment type attribute in " + JSON.stringify(deploymentAction)
        throw new Error(message)
      }
      if (!deploymentAction.identifier) {
        let message = "Illegal deployment, no identifier attribute in " + JSON.stringify(deploymentAction)
        throw new Error(message)
      }
      deploymentAction.state = state

      if (deploymentAction.type === "k8s") {
        addK8sDeployment(deploymentAction)
      } else if (deploymentAction.type === "deployer") {
        addDockerDeployer(deploymentAction)
      }
      return deploymentAction
    }

    function K8sDeploymentPromises(deploymentOptions) {
      return Object.values(k8sDeploymentActions).flatMap((k8sContainerDeployment: TDeploymentPlan) => {
        return k8sContainerDeployment.deployments.map(async k8sDeploymentAction => {
          return await k8sDeploymentAction.execute(deploymentOptions, cmd, logger, saveDeploymentState)
        })
      })
    }

    function DeployerPromises(deploymentOptions) {
      return Object.values(dockerDeploymentPlan).flatMap((deploymentPlan: TDeploymentPlan) =>
        deploymentPlan.deployments.map(async deployment => {
          if (deployment.state.modified) {
            if (deploymentOptions.dryRun) {
              let writePath = path.join(
                deploymentOptions.dryRunOutputDir,
                deployment.imageWithoutTag.replace(/\//g, "_") + "-deployer.txt",
              )

              let cmdLine = `docker run ${deployment.forTestParameters.join(" ")}`

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
        }),
      )
    }

    async function mapDeploymentDataAndPush(deploymentData) {
      if (!deploymentData) {
        return deploymentData
      } else {
        const mappedData = mapUntypedDeploymentData(deploymentData)
        uiDataPusher && await uiDataPusher.pushDeploymentStateToUI(mappedData)
        return deploymentData
      }
    }


    function mapDeploymentDataAndWriteTo(dryrunOutputDir) {
      return async (deploymentData) => {
        if (!deploymentData) {
          return deploymentData
        } else {
          const mappedData = mapUntypedDeploymentData(deploymentData)
          const writePath = path.join(dryrunOutputDir, `send-to-ui-${mappedData.deploymentState.key}.json`)
          await writeFile(writePath, JSON.stringify(deploymentData, null, 2))
          return deploymentData
        }
      }
    }

    async function executePlan(runOptions: TActionExecutionOptions = { dryRun: false, dryRunOutputDir: undefined, forcePush: false }) {
      // let i = 0
      const shouldPush = !runOptions.dryRun || runOptions.forcePush
      let deploymentPromises = K8sDeploymentPromises(runOptions)
      let allPromises = deploymentPromises.concat(DeployerPromises(runOptions))

      deploymentPromises = allPromises.map(promise => {
        if (shouldPush) {
          return promise.then(mapDeploymentDataAndPush)
        } else if (runOptions.dryRun) {
          return promise.then(mapDeploymentDataAndWriteTo(runOptions.dryRunOutputDir))
        } else {
          return promise.then()
        }
      })

      // console.info('deploymentPromises', deploymentPromises)

      const deployments = await Promise.all(deploymentPromises)
      // deployments.forEach((deployment)=>{
      //   runOptions.uiBackend(deployment)
      // })
      // console.info('deployments', deployments)
      return deployments
    }

    function printPlan(logger) {
      Object.entries(k8sDeploymentActions as TK8sDeploymentPlan).forEach(([_key, plan]) => {
        let modified = false
        if (plan.deployments) {
          plan.deployments.forEach(function(deployment) {
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
          plan.deployments.forEach(function(deployment) {
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

    function exportDeploymentDocuments(exportDirectory) {
      return new Promise(function(resolve, reject) {
        let fileWrites = emptyArray<any>()

        Object.entries(k8sDeploymentActions as TK8sDeploymentPlan).forEach(function([_key, plan]) {
          plan.deployments.forEach(function(deployment) {
            let writePath = path.join(
              exportDirectory,
              deployment.operation + "-" + deployment.identifier.toLowerCase() + ".yaml",
            )
            let writePromise = writeFile(writePath, deployment.descriptor.trim())
            fileWrites.push(writePromise)
          })
        })
        Object.entries(dockerDeploymentPlan as TDockerDeploymentPlan).forEach(function([_key, plan]) {
          plan.deployments.forEach(function(deployment) {
            let cmdLine = `docker run ${deployment.forTestParameters.join(" ")}`

            let writePath = path.join(exportDirectory, deployment.imageWithoutTag.replace(/\//g, "_") + "-deployer.txt")
            let writePromise = writeFile(writePath, cmdLine)
            fileWrites.push(writePromise)
          })
        })
        Promise.all(fileWrites)
          .then(resolve)
          .catch(reject)
      })
    }

    return {
      async addDeployment(deploymentAction) {
        deploymentAction.env = forEnv
        return await addToPlanAndGetDeploymentStateFromStore(deploymentAction)
      },
      executePlan: executePlan,
      printPlan: printPlan,
      exportDeploymentDocuments: exportDeploymentDocuments,
    }
  }
}
