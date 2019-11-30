import { TDeployerMetadata } from "@shepherdorg/metadata"

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
  herdKey: string;
  path: string;
  description: string;
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
  [property: string]: THerdFolderSpec
}

export interface THerdFolderSpec {
  path: string;
  description: string;
  herdKey: string;
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
  herdSpec: THerdSpec;
  metadata: TMetadata;
}

export interface TImageDeploymentAction {
  displayName: string;
  herdKey: string;
  metadata: TDeployerMetadata;
  herdSpec: HerdSpec;
  dockerParameters: string[];
  forTestParameters?: string[];
  imageWithoutTag?: string;
  origin: string;
  type: string;
  operation: string;
  command: string;
  identifier: string;
}


export interface HerdSpec {
  dockerImage: string;
  herdKey: string;
  image: string;
  imagetag: string;
}
