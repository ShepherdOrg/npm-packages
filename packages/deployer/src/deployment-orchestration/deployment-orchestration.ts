import {
  IAnyDeploymentAction,
  IDockerImageKubectlDeploymentAction,
  ILog,
  TActionExecutionOptions,
  TDeploymentOrchestrationDependencies,
} from "../deployment-types"
import { TFileSystemPath } from "../helpers/basic-types"
import {
  IDeploymentPlan,
  IDeploymentPlanExecutionResult,
  TK8sDeploymentPlansByKey,
} from "../deployment-plan/deployment-plan"
import { flatMapPolyfill } from "../herd-loading/folder-loader/flatmap-polyfill"

flatMapPolyfill()

export interface IDeploymentOrchestration {
  executePlans: (runOptions?: TActionExecutionOptions) => Promise<Array<IDeploymentPlanExecutionResult>>

  /** Returns true if there is anything planned to be executed. */
  printPlan: (logger: ILog) => boolean
  exportDeploymentActions: (exportDirectory: TFileSystemPath) => Promise<unknown>
  addDeploymentPlan(deploymentPlan: IDeploymentPlan): Promise<IDeploymentPlan>
}

export type FDeploymentOrchestrationConstructor = (env: string) => IDeploymentOrchestration


export function DeploymentOrchestration(_injected: TDeploymentOrchestrationDependencies): IDeploymentOrchestration {

  const deploymentPlans: Array<IDeploymentPlan> = []

  const k8sDeploymentPlans: TK8sDeploymentPlansByKey = {}

  const k8sDeploymentsByIdentifier: { [key: string]: IDockerImageKubectlDeploymentAction } = {}

  function addActionToCatalog(deploymentAction: IDockerImageKubectlDeploymentAction) {
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
      addActionToCatalog(deploymentAction as IDockerImageKubectlDeploymentAction)
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
