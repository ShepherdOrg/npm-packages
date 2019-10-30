import {
  TDeployerMetadata,
  TDeploymentState,
  THerdSpec,
} from "@shepherdorg/metadata"
import { TK8sMetadata } from "@shepherdorg/metadata"

export type THerdMetadata = {
  herdSpec: THerdSpec
  deploymentState: TDeploymentState
  timestamp?: Date
}

export type THerdDeployerMetadata = TDeployerMetadata & THerdMetadata

export type THerdK8sMetadata = TK8sMetadata & THerdMetadata
