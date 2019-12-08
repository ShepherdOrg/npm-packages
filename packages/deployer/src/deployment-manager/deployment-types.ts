import { TDeployerMetadata, TDeploymentState, TImageMetadata, TK8sMetadata } from "@shepherdorg/metadata"

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
  description: string;
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

export interface TImageDeploymentAction {
  displayName: string;
  herdKey: string;
  metadata: TDeployerMetadata;
  herdSpec: TDockerImageHerdSpec;
  dockerParameters: string[];
  forTestParameters?: string[];
  imageWithoutTag?: string;
  origin: string;
  type: string;
  operation: string;
  command: string;
  identifier: string;
  env?: string;
}

export type TTempMetadataType = (TImageMetadata | TK8sMetadata)

export interface TTempDeploymentInfoType {
  herdKey: string
  herdSpec: TTempHerdSpec
  state: TDeploymentState
  metadata: TTempMetadataType

  descriptor: string
  env: string
  fileName: string
  identifier: string
  operation: string
  origin: string
  type: string
  version: string
}
