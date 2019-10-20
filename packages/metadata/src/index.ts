export type TDockerImageInspection = any
export type TCompressedMetadata = string

type TTarFolderStructure = any

export type THref = {
    title: string
    url: string
}


export type THerdSpec ={
    key: string // Key used in herd file
    image: string // For example isrvkbuild02:5000/fluentd
    imagetag: string // For example v1.1.2-g-2b48d1c
    description: string //"Log writer to AWS ES/Kibana"
}

export enum TDeploymentType {
    Deployer='deployer',
    Kubernetes='k8s'
}

export enum TDeployerRole{
    Infrastructure='infrastructure',
    Migration='migration',
    Install='install'
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

export type TShepherdMetadata = {
    displayName: string
    deploymentType: TDeploymentType
    migrationImage?: string
    lastCommits: string
    gitUrl: string
    gitHash: string
    buildDate: Date
    gitCommit?: string
    dockerImageTag?: string
    buildHostName?: string
    hyperlinks?: Array<THref>
}

export type TShepherdDeployerMetadata = TShepherdMetadata & {
    deployCommand: string
    rollbackCommand?: string
// TODO: Support dryrun command
    dryrunCommand?: string
// TODO: Support e2e test command
    e2eTestCommand?: string
    environmentVariablesExpansionString: string
    deployerRole: TDeployerRole
}

export type TShepherdK8sMetadata = TShepherdMetadata & {
    kubeDeploymentFiles?: TTarFolderStructure
    kubeConfigB64?: string
}


export type TShepherdExtendedMetadata = TShepherdMetadata & {
    id: string
    herdSpec: THerdSpec
    deploymentState: TDeploymentState
    timestamp?: Date;
}


