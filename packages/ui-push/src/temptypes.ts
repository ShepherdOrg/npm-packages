import {
  TDeployerMetadata,
  TDeploymentState, TDeploymentType,
  THerdSpec,
} from "@shepherdorg/metadata"
import { TK8sMetadata } from "@shepherdorg/metadata"

export type THerdMetadata = {
  herdSpec: THerdSpec
  deploymentState: TDeploymentState
  timestamp?: Date
}

export type THerdDeployerMetadata = TDeployerMetadata & THerdMetadata

export function isHerdDeployerMetadata(obj: any): obj is THerdDeployerMetadata{
  return obj.herdSpec && obj.deploymentType == TDeploymentType.Deployer
}

export type THerdK8sMetadata = TK8sMetadata & THerdMetadata

export function isHerdK8sMetadata(obj: any): obj is THerdK8sMetadata{
  return obj.herdSpec && obj.deploymentType == TDeploymentType.Kubernetes
}

