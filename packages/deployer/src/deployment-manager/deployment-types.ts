import { TDeployerMetadata, TDeploymentState, TImageMetadata, TK8sMetadata } from "@shepherdorg/metadata"
import { TDescriptorsByKind } from "./kubectl-deployer/k8s-deployment-document-identifier"

export type ILog = {
  info: typeof console.info,
  debug: typeof console.debug,
  warn: typeof console.warn
}

export type THref = {
  title: string
  url: string
}


export interface THerdSpec {
  key: string;
  description?: string;
  delete?: boolean;
}

export type TFolderHerdSpec = THerdSpec & {
  path: string;
}

export type TDockerImageHerdSpec = THerdSpec & {
  dockerImage?: string;

  image: string;
  imagetag: string;
}

export function isDockerImageHerdSpec(spec: TDockerImageHerdSpec | TFolderHerdSpec): spec is TDockerImageHerdSpec {
  return Boolean((spec as TDockerImageHerdSpec).image)
}

export type TTempHerdSpec = {
  herdKey: string
  image: string
  imagetag: string
  description: string
}



/// From metadata module, discrepancy here...key and herdKey

/// New types below


export type TInfrastructureImageMap = {
  [property: string]: any
}


export type TImageMap = {
  [property: string]: any
}

export type THerdFolderMap = {
  [property: string]: TFolderHerdSpec
}


export interface TMetadata {
  buildDate: Date;
  deploymentType: string;
  displayName: string;
  hyperlinks: any[];
  semanticVersion: string;

  gitBranch?: string;
  gitHash?: string;
  gitUrl?: string;
  lastCommits?: string;
}


export interface TFolderDeploymentPlan {
  operation: string;
  identifier: string;
  version: string;
  descriptor: string;
  origin: string;
  type: string;
  fileName: string;
  herdKey: string;
  herdSpec: TFolderHerdSpec;
  metadata: TMetadata;
}

export interface TBaseDeploymentAction {
  state?: TDeploymentState // State on action or deployment? StateDependentAction, StateMutatingAction (as opposed to wait actions). Model this differently?
  identifier: string
  env: string
}

export type TDeploymentStateParamsForReference = {
  version: string
  identifier: string
  env: string
  descriptor: string
  operation: string
}


export interface TFullDeploymentAction extends TBaseDeploymentAction{
  herdKey: string
  herdSpec: TTempHerdSpec
  metadata: TTempMetadataType

  descriptor: string
  fileName: string
  operation: string
  origin: string
  type: string
  version: string
}


export interface TImageDeploymentAction extends TBaseDeploymentAction{
  herdSpec: TDockerImageHerdSpec;
  metadata: TDeployerMetadata;

  command: string;
  descriptor: string;
  displayName: string;
  dockerParameters: string[];
  forTestParameters?: string[];
  herdKey: string;
  identifier: string;
  imageWithoutTag?: string;
  operation: string;
  origin: string;
  type: string;
}

export type TTempMetadataType = (TImageMetadata | TK8sMetadata)


export interface TKubectlDeployAction extends TBaseDeploymentAction{
  descriptorsByKind: TDescriptorsByKind
  identifier: string
  descriptor: string
  deploymentRollouts: string[] // TODO Move into deploymentActions
  origin: string
  operation: string

  execute(deploymentOptions, cmd, logger, saveDeploymentState)
}

export interface TK8sDockerImageDeploymentAction extends TKubectlDeployAction {
  herdSpec: THerdSpec
  metadata: TK8sMetadata
  version: string,
  type: string,
  fileName: string,
  herdKey: string
}


