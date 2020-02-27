import { IReleaseStateStore } from "@shepherdorg/state-store"
import { ILog } from "../deployment-types"
import { TFeatureDeploymentConfig } from "../triggered-deployment/create-upstream-trigger-deployment-config"
import { IExec } from "../helpers/basic-types"
import { DeploymentOrchestration } from "../deployment-orchestration/deployment-orchestration"
import {
  createDeploymentPlanFactory,
  IDeploymentPlanFactory,
  TDeploymentPlanDependencies,
} from "../deployment-plan/deployment-plan"
import { createHerdLoader } from "./herd-loader"
import { getDockerRegistryClientsFromConfig, imageLabelsLoader } from "@shepherdorg/docker-image-metadata-loader"
import { IPushToShepherdUI } from "../shepherd"
import { createRolloutWaitActionFactory } from "../deployment-actions/kubectl-action/rollout-wait-action-factory"
import { createDockerImageKubectlDeploymentActionsFactory } from "../deployment-actions/kubectl-action/create-docker-kubectl-deployment-actions"
import {
  createKubectlDeploymentActionsFactory,
  ICreateKubectlDeploymentAction,
} from "../deployment-actions/kubectl-action/kubectl-deployment-action-factory"
import { createDockerDeployerActionFactory } from "../deployment-actions/docker-action/create-docker-deployment-action"
import { createDockerActionFactory } from "../deployment-actions/docker-action/docker-action"
import { createDeploymentTestActionFactory, ICreateDeploymentTestAction } from "./image-loader/deployment-test-action"

interface TLoaderContextParams {
  stateStore: IReleaseStateStore
  logger: ILog
  featureDeploymentConfig: TFeatureDeploymentConfig
  exec: IExec
  uiPusher: IPushToShepherdUI
}

export function createLoaderContext({
  stateStore,
  logger,
  featureDeploymentConfig,
  exec,
  uiPusher,
}: TLoaderContextParams) {
  const deploymentOrchestration = DeploymentOrchestration({
    cmd: exec,
    logger: logger,
    stateStore: stateStore,
  })

  let deploymentActionFactory: ICreateKubectlDeploymentAction = createKubectlDeploymentActionsFactory({
    exec,
    logger,
    stateStore,
  })
  let rolloutWaitActionFactory = createRolloutWaitActionFactory({
    exec: exec,
    logger: logger,
    stateStore: stateStore,
  })
  let dockerImageKubectlDeploymentActionFactory = createDockerImageKubectlDeploymentActionsFactory({
    deploymentActionFactory,
    logger,
  })
  let dockerActionFactory = createDockerActionFactory({
    exec,
    logger,
    stateStore,
  })
  let deployerActionFactory = createDockerDeployerActionFactory({
    executionActionFactory: dockerActionFactory,
    logger: logger,
  })

  let deploymentTestActionFactory: ICreateDeploymentTestAction = createDeploymentTestActionFactory({
    logger,
    dockerActionFactory,
  })

  let planDependencies: TDeploymentPlanDependencies = {
    uiDataPusher: uiPusher,
    exec: exec,
    logger: logger,
    stateStore: stateStore,
    rolloutWaitActionFactory: rolloutWaitActionFactory,
    dockerImageKubectlDeploymentActionFactory: dockerImageKubectlDeploymentActionFactory,
    deployerActionFactory,
    deploymentTestActionFactory,
  }

  let planFactory: IDeploymentPlanFactory = createDeploymentPlanFactory(planDependencies)

  return createHerdLoader({
    logger: logger,
    deploymentOrchestration: deploymentOrchestration,
    exec: exec,
    featureDeploymentConfig,
    planFactory: planFactory,
    stateStore: stateStore,
    labelsLoader: {
      imageLabelsLoader: imageLabelsLoader,
      getDockerRegistryClientsFromConfig: getDockerRegistryClientsFromConfig,
    },
  })
}
