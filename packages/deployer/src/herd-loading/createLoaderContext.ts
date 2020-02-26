import { IReleaseStateStore } from "@shepherdorg/state-store"
import { ILog } from "../deployment-types"
import { TFeatureDeploymentConfig } from "../triggered-deployment/create-upstream-trigger-deployment-config"
import { IExec } from "../helpers/basic-types"
import { DeploymentOrchestration } from "../deployment-orchestration/deployment-orchestration"
import { CreateLogger } from "../logging/logger"
import {
  DeploymentPlanFactory,
  IDeploymentPlanFactory,
  TDeploymentPlanDependencies,
} from "../deployment-plan/deployment-plan-factory"
import { createHerdLoader } from "./herd-loader"
import { getDockerRegistryClientsFromConfig, imageLabelsLoader } from "@shepherdorg/docker-image-metadata-loader"
import { IPushToShepherdUI } from "../shepherd"
import { createRolloutWaitActionFactory } from "../deployment-actions/kubectl-action/rollout-wait-action-factory"

interface TLoaderContextParams {
  stateStore: IReleaseStateStore
  logger: ILog
  featureDeploymentConfig: TFeatureDeploymentConfig
  exec: IExec
  ui: IPushToShepherdUI
}

export function createLoaderContext({ stateStore, logger, featureDeploymentConfig, exec, ui }: TLoaderContextParams) {
  const deploymentOrchestration = DeploymentOrchestration({
    cmd: exec,
    logger: CreateLogger(console),
    stateStore: stateStore,
  })

  let planDependencies: TDeploymentPlanDependencies = {
    uiDataPusher: ui,
    exec: exec,
    logger: logger,
    stateStore: stateStore,
    rolloutWaitActionFactory: createRolloutWaitActionFactory({
      exec: exec,
      logger: logger,
      stateStore: stateStore,
    }),
  }

  let planFactory: IDeploymentPlanFactory = DeploymentPlanFactory(planDependencies)

  return createHerdLoader({
    logger: CreateLogger(console),
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
