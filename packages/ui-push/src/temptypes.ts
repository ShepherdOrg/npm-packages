import {
  TDeployerMetadata,
  TDeploymentState,
  THerdSpec,
} from "../../metadata/src"
import { TK8sMetadata } from "../../metadata/src"

export type THerdMetadata = {
  herdSpec: THerdSpec
  deploymentState: TDeploymentState
  timestamp?: Date
}

export type THerdDeployerMetadata = TDeployerMetadata & THerdMetadata

export type THerdK8sMetadata = TK8sMetadata & THerdMetadata
