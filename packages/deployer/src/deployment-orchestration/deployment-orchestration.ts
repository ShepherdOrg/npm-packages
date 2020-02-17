import * as path from "path"

import { emptyArray } from "../helpers/ts-functions"
import { writeFile } from "../helpers/promisified"
import {
  IAnyDeploymentAction,
  IDeploymentOrchestration,
  IDockerDeploymentAction,
  IK8sDirDeploymentAction,
  IK8sDockerImageDeploymentAction,
  ILog,
  TActionExecutionOptions,
  TDeploymentOrchestrationDependencies,
} from "../deployment-types"
import { mapUntypedDeploymentData } from "../ui-mapping/map-untyped-deployment-data"
import { TFileSystemPath } from "../helpers/basic-types"
import { Oops } from "oops-error"
import {
  DeploymentPlanFactory,
  IDeploymentPlan,
  TK8sDeploymentPlansByKey,
} from "../deployment-plan/deployment-plan-factory"
import { flatMapPolyfill } from "../herd-loading/folder-loader/flatmap-polyfill"

flatMapPolyfill()

export function DeploymentOrchestration(injected: TDeploymentOrchestrationDependencies): IDeploymentOrchestration {
  const stateStore = injected.stateStore

  const deploymentPlans: Array<IDeploymentPlan> = []

  const k8sDeploymentPlans: TK8sDeploymentPlansByKey = {}

  const k8sDeploymentsByIdentifier: { [key: string]: IK8sDockerImageDeploymentAction } = {}

  function addActionToCatalog(deploymentAction: IK8sDockerImageDeploymentAction) {
    k8sDeploymentPlans[deploymentAction.origin] =
      k8sDeploymentPlans[deploymentAction.origin] || deploymentAction.herdKey
    // await k8sDeploymentPlans[deploymentAction.origin].addAction(deploymentAction)

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


  function preventDuplicateKubectlDeployment(
    deploymentAction: IAnyDeploymentAction,
  ): IAnyDeploymentAction {
    if (deploymentAction.type === "k8s") {
      addActionToCatalog(deploymentAction as IK8sDockerImageDeploymentAction)
    }
    return deploymentAction
  }

  async function executePlans(
    runOptions: TActionExecutionOptions = {
      dryRun: false,
      dryRunOutputDir: undefined,
      pushToUi: true,
      waitForRollout: false,
    },
  ) {
    return await Promise.all(deploymentPlans.map((deploymentPlan) => deploymentPlan.execute(runOptions)))
  }

  function printPlan(logger: ILog) {
    let anythingPlanned = deploymentPlans.reduce((anyChanges, deploymentPlan,)=>{
      return anyChanges || deploymentPlan.printPlan(logger)}, false)
    if(!anythingPlanned){
      logger.info('No plans to do anything this time')
    }
    return anythingPlanned
  }

  function exportDeploymentActions(_exportDirectory: TFileSystemPath): Promise<void> {
    return new Promise(function(resolve, reject) {
      let fileWrites = emptyArray<any>()

      // Object.entries(k8sDeploymentPlans as TK8sDeploymentPlansByKey).forEach(function([_key, plan]) {
      //   plan.deploymentActions.forEach(function(deployment: IK8sDockerImageDeploymentAction) {
      //     if (deployment.identifier) {
      //       let writePath = path.join(
      //         exportDirectory,
      //         deployment.operation + "-" + deployment.identifier.toLowerCase() + ".yaml",
      //       )
      //       let writePromise = writeFile(writePath, deployment.descriptor.trim())
      //       fileWrites.push(writePromise)
      //     } // else its a followup action, such as rollout status or e2e test, which we do not export
      //   })
      // })
      // Object.entries(dockerDeploymentPlan as TDockerDeploymentPlansByKey).forEach(function([
      //                                                                                        _key,
      //                                                                                        plan,
      //                                                                                      ]: TDockerDeploymentPlanTuple) {
      //   plan.deploymentActions.forEach(function(deploymentAction: IDockerDeploymentAction) {
      //     if (!deploymentAction.forTestParameters) {
      //       throw new Error("Missing forTestParameters!")
      //     }
      //     if (!deploymentAction.imageWithoutTag) {
      //       throw new Error("Missing forTestParameters!")
      //     }
      //     let cmdLine = `docker run ${deploymentAction.forTestParameters.join(" ")}`
      //
      //     let writePath = path.join(
      //       exportDirectory,
      //       deploymentAction.imageWithoutTag.replace(/\//g, "_") + "-deployer.txt",
      //     )
      //     let writePromise = writeFile(writePath, cmdLine)
      //     fileWrites.push(writePromise)
      //   })
      // })
      Promise.all(fileWrites)
        .then(() => {
          resolve()
        })
        .catch(reject)
    })
  }

  return {
    // TODO This should go once we are only adding IDeploymentPlan instances
    executePlans: executePlans,
    printPlan: printPlan,
    exportDeploymentActions: exportDeploymentActions,
    async addDeploymentPlan(deploymentPlan: IDeploymentPlan): Promise<IDeploymentPlan> {
      deploymentPlans.push(deploymentPlan)
      deploymentPlan.deploymentActions.forEach(preventDuplicateKubectlDeployment)
      return deploymentPlan
    },
  }
}
