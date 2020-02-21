
export type TDockerImageInspection = any
export type TCompressedMetadata = string

export type TNamedEnvironmentValue<TValueType> = { name: string, value: TValueType, secret?: boolean }

export type TEnvironmentVariables = Array<TNamedEnvironmentValue<string>>

export type TarFile ={
  path: string
  content: string
}

export type TTarFolderStructure =  { [path:string]:TarFile; }

export type THref = {
  title: string
  url: string
}

export type THerdSpec = {
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


// TDeploymentActionResult
export type TDeploymentState = {
  env: string
  key: string
  lastVersion?: string
  modified: boolean
  new: boolean
  operation: string
  signature: string
  stderr?: string  // Error output
  stdout?: string  // Output from deployment action execution
  timestamp?: Date
  version: string
}

export type TDockerImageUrl = string

export type TTestSpecification ={
  command:string
  dockerImageUrl?:TDockerImageUrl
  environment?:TEnvironmentVariables
}

export type TImageMetadata = {
  dockerRegistry?: string
  dockerRepository?: string
  buildDate: Date
  buildHostName?: string
  deploymentType: TDeploymentType
  displayName: string
  dockerImageUrl?: TDockerImageUrl
  dockerImageTag?: string
  dockerImageGithash?: string
  end2endTestCommand?: string
  gitBranch: string
  gitCommit?: string
  gitHash: string
  gitUrl: string
  hyperlinks?: Array<THref>
  lastCommits: string
  migrationImage?: string
  semanticVersion: string
  preDeployTest?: TTestSpecification
  postDeployTest?: TTestSpecification
}

export type TDeployerMetadata = TImageMetadata & {
  deployCommand: string
  rollbackCommand?: string
  // TODO: Support dryrun command
  dryrunCommand?: string
  // TODO: Make obsolete
  environmentVariablesExpansionString: string
  // TODO: Add tests for environment array
  environment: TEnvironmentVariables
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


