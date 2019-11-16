type TarFile ={
  path: string
  content: string
}

type TTarFolderStructure =  { [path:string]:TarFile; }

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
export type TMetadataHerdSpec = {
  key: string // Key used in herd file
  image: string // For example isrvkbuild02:5000/fluentd
  imagetag: string // For example v1.1.2-g-2b48d1c
  description: string //"Log writer to AWS ES/Kibana"
}

export enum TDeploymentType {
  Deployer = "deployer",
  Kubernetes = "k8s",
}

export enum TDeployerRole {
  Infrastructure = "infrastructure",
  Migration = "migration",
  Install = "install",
}

export type TDeploymentState = {
  new: boolean
  key: string
  modified: boolean
  operation: string
  version: string
  lastVersion?: string
  timestamp?: Date
  signature: string
  env: string
}

export type TImageMetadata = {
  displayName: string
  semanticVersion: string
  deploymentType: TDeploymentType
  migrationImage?: string
  lastCommits: string
  gitUrl: string
  gitHash: string
  gitBranch: string
  buildDate: Date
  gitCommit?: string
  dockerImageTag?: string
  buildHostName?: string
  e2eTestCommand?: string
  hyperlinks?: Array<THref>
}


export type TDeployerMetadata = TImageMetadata & {
  deployCommand: string
  rollbackCommand?: string
  // TODO: Support dryrun command
  dryrunCommand?: string
  environmentVariablesExpansionString: string
  deployerRole: TDeployerRole
}

export type TK8sMetadata = TImageMetadata & {
  kubeDeploymentFiles?: TTarFolderStructure
  kubeConfigB64?: string
}


export type THerdMetadata ={
  herdSpec: THerdSpec
  deploymentState: TDeploymentState
  timestamp?: Date
}

export type THerdDeployerMetadata = TDeployerMetadata & THerdMetadata

export type THerdK8sMetadata = TK8sMetadata & THerdMetadata

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

export interface TImageDeploymentPlan {
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
