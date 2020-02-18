import {
  IAnyDeploymentAction,
  IDeploymentOrchestration,
  IK8sDockerImageDeploymentAction,
  ILog,
  TActionExecutionOptions,
  TDeploymentOrchestrationDependencies,
} from "../deployment-types"
import { TFileSystemPath } from "../helpers/basic-types"
import { IDeploymentPlan, TK8sDeploymentPlansByKey } from "../deployment-plan/deployment-plan-factory"
import { flatMapPolyfill } from "../herd-loading/folder-loader/flatmap-polyfill"

flatMapPolyfill()

export function DeploymentOrchestration(_injected: TDeploymentOrchestrationDependencies): IDeploymentOrchestration {

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
      const planChanges = deploymentPlan.printPlan(logger)
      return anyChanges || planChanges}, false)
    if(!anythingPlanned){
      logger.info('No plans to do anything this time')
    }
    return anythingPlanned
  }

  async function exportDeploymentActions(_exportDirectory: TFileSystemPath): Promise<void> {
    await Promise.all(deploymentPlans.map(async (deploymentPlan)=>{
      return deploymentPlan.exportActions(_exportDirectory)
    }))
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
