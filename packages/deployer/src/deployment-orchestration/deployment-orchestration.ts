import * as path from "path"

import { emptyArray } from "../helpers/ts-functions"
import { writeFile } from "../helpers/promisified"
import {
  FDeploymentOrchestrationConstructor,
  IAnyDeploymentAction,
  IBaseDeploymentAction,
  IDockerDeploymentAction,
  IK8sDirDeploymentAction,
  IK8sDockerImageDeploymentAction,
  IKubectlDeployAction,
  ILog,
  TActionExecutionOptions,
  TDeploymentOrchestration,
  TDeploymentPlan,
  TDockerDeploymentPlan,
  TDockerDeploymentPlanTuple,
  TK8sDeploymentActionMap,
  TK8sDeploymentPlan,
  TReleasePlanDependencies,
} from "../deployment-types"
import { mapUntypedDeploymentData } from "../ui-mapping/map-untyped-deployment-data"
import { TFileSystemPath } from "../helpers/basic-types"
import { newProgrammerOops, Oops } from "oops-error"
import Bluebird = require("bluebird")

function CreateDeploymentPlan<TActionType extends IBaseDeploymentAction>(deployment: TActionType) : TDeploymentPlan<TActionType> {
  return {
    herdKey: deployment.herdKey,
    deploymentActions: [],
  }
}

export function DeploymentOrchestrationModule(injected: TReleasePlanDependencies) : FDeploymentOrchestrationConstructor {
  const stateStore = injected.stateStore
  const cmd = injected.cmd
  const logger = injected.logger
  const uiDataPusher = injected.uiDataPusher

  return function(forEnv: string): TDeploymentOrchestration {
    if (!forEnv) {
      throw new Error("must specify environment you are creating a deployment plan for")
    }

    // Need better typing and logic around DeploymentPlan for each declared deployment that contains declaration and actions in deployment. Probably key to simplifying codebase significantly.

    const k8sDeploymentActions: TK8sDeploymentActionMap = {}
    const dockerDeploymentPlan: TDockerDeploymentPlan = {}

    const k8sDeploymentsByIdentifier: { [key: string]: IK8sDockerImageDeploymentAction } = {}

    function addKubectlDeploymentAction(deploymentAction: IK8sDockerImageDeploymentAction) {
      k8sDeploymentActions[deploymentAction.origin] = k8sDeploymentActions[deploymentAction.origin] || CreateDeploymentPlan<IK8sDockerImageDeploymentAction>(deploymentAction)
      k8sDeploymentActions[deploymentAction.origin].deploymentActions.push(deploymentAction)

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

    function addDockerDeploymentAction(deploymentAction: IDockerDeploymentAction) {
      dockerDeploymentPlan[deploymentAction.origin] = dockerDeploymentPlan[deploymentAction.origin] || CreateDeploymentPlan<IDockerDeploymentAction>(deploymentAction)

      dockerDeploymentPlan[deploymentAction.origin].deploymentActions.push(deploymentAction)
    }

    function saveDeploymentState(deployment: IK8sDockerImageDeploymentAction | IDockerDeploymentAction | IK8sDirDeploymentAction) {
      if (!deployment.state) {
        throw new Oops({ message: "State is mandatory here", category: "ProgrammerError" })
      }
      return stateStore.saveDeploymentState(deployment.state)
    }

    async function addToPlanAndGetDeploymentStateFromStore(
      deploymentAction: IAnyDeploymentAction,
    ): Promise<IAnyDeploymentAction> {
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
        addKubectlDeploymentAction(deploymentAction as IK8sDockerImageDeploymentAction)
      } else if (deploymentAction.type === "deployer") {
        addDockerDeploymentAction(deploymentAction as IDockerDeploymentAction)
      }
      return deploymentAction
    }


    function K8sDeploymentPromises(deploymentOptions: TActionExecutionOptions): Array<Promise<IK8sDockerImageDeploymentAction | IK8sDirDeploymentAction>> {
      return Object.values(k8sDeploymentActions).flatMap((k8sContainerDeployment: TDeploymentPlan<IKubectlDeployAction>) => {
        return k8sContainerDeployment.deploymentActions.map(async (k8sDeploymentAction: IK8sDockerImageDeploymentAction | IK8sDirDeploymentAction) => {
          await k8sDeploymentAction.execute(deploymentOptions, cmd, logger, saveDeploymentState)
          return k8sDeploymentAction
        })
      })
    }

    function DeployerPromises(deploymentOptions: TActionExecutionOptions): Array<Promise<IDockerDeploymentAction | undefined>> {
      return Object.values(dockerDeploymentPlan).flatMap((deploymentPlan: TDeploymentPlan<IDockerDeploymentAction>) => {
        return deploymentPlan.deploymentActions.map(async (deployment: IDockerDeploymentAction) => {
          if (deployment.state?.modified) {
            return await deployment.execute(deploymentOptions, cmd, logger, saveDeploymentState)
          } else {
            return undefined
          }
        })
      })
    }

    async function mapDeploymentDataAndPush(deploymentData: IAnyDeploymentAction | undefined) {
      if (!deploymentData) {
        return deploymentData
      } else {
        const mappedData = mapUntypedDeploymentData(deploymentData)
        uiDataPusher && (await uiDataPusher.pushDeploymentStateToUI(mappedData))
        return deploymentData
      }
    }

    function mapDeploymentDataAndWriteTo(dryrunOutputDir: TFileSystemPath) {
      return async (deploymentData: IAnyDeploymentAction | undefined) => {
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
      let deploymentPromises: Array<Promise<IAnyDeploymentAction | undefined>> = K8sDeploymentPromises(runOptions)

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

      return Bluebird.all(deploymentPromises)
    }

    function printPlan(logger: ILog) {


      Object.entries(dockerDeploymentPlan as TDockerDeploymentPlan).forEach(([_key, plan] : TDockerDeploymentPlanTuple) => {
        let modified = false

        if (plan.deploymentActions) {
          plan.deploymentActions.forEach(function(deployment: IDockerDeploymentAction) {
            if (!deployment.state) {
              throw new Error("No state!")
            }
            if (deployment.state.modified) {
              logger.info(`Running ${plan.herdKey} deployer`)
              logger.info(`  -  docker run ${deployment.identifier} ${deployment.command}`)
              modified = true
            }
          })
        }
        if (!modified) {
          logger.info("No modifications to " + plan.herdKey)
        }
      })

      Object.entries(k8sDeploymentActions as TK8sDeploymentPlan).forEach(([_key, plan]) => {
        let modified = false
        if (plan.deploymentActions) {
          plan.deploymentActions.forEach(function(deploymentAction: IK8sDockerImageDeploymentAction) {
            if (!deploymentAction.state) {
              throw new Error("No state!")
            }
            if (deploymentAction.state.modified) {
              if (!modified) {
                if (plan.herdKey) {
                  logger.info(`Applying ${plan.herdKey}`)
                } else {
                  logger.info("Missing herdKey for ", plan)
                }
              }
              modified = true
              logger.info(`  -  kubectl ${deploymentAction.operation} ${deploymentAction.identifier}`)
            }
          })
        }
        if (!modified) {
          logger.info("No modified deployments in " + plan.herdKey)
        }
      })
    }

    function exportDeploymentActions(exportDirectory: TFileSystemPath):Promise<void> {
      return new Promise(function(resolve, reject) {
        let fileWrites = emptyArray<any>()

        Object.entries(k8sDeploymentActions as TK8sDeploymentPlan).forEach(function([_key, plan]) {
          plan.deploymentActions.forEach(function(deployment: IK8sDockerImageDeploymentAction) {
            let writePath = path.join(
              exportDirectory,
              deployment.operation + "-" + deployment.identifier.toLowerCase() + ".yaml",
            )
            let writePromise = writeFile(writePath, deployment.descriptor.trim())
            fileWrites.push(writePromise)
          })
        })
        Object.entries(dockerDeploymentPlan as TDockerDeploymentPlan).forEach(function([_key, plan]: TDockerDeploymentPlanTuple) {
          plan.deploymentActions.forEach(function(deploymentAction: IDockerDeploymentAction) {
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
          .then(()=>{
            resolve()
          })
          .catch(reject)
      })
    }

    return {
      async addDeployment(deploymentAction: IAnyDeploymentAction) {
        deploymentAction.env = forEnv
        if (!deploymentAction.herdDeclaration.sectionDeclaration) {
          throw newProgrammerOops('Must get herd section declaration with deployment action to determine execution order')
        }
        return await addToPlanAndGetDeploymentStateFromStore(deploymentAction)
      },
      executePlan: executePlan,
      printPlan: printPlan,
      exportDeploymentActions: exportDeploymentActions,
    }
  }
}
