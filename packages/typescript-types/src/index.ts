
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


export interface IStorageBackend {
    get(key: string): any |TDeploymentState
    set(key: any, timestampedObject: any | TDeploymentState): any | TDeploymentState // Maybe have explicit type on this later, tests not compatible right now.

    connect()
    disconnect()
}

export type TStateStoreDependencies = {
    storageBackend: IStorageBackend
}


export type THerdSpec ={
    key: string // Key used in herd file
    image: string // For example isrvkbuild02:5000/fluentd
    imagetag: string // For example v1.1.2-g-2b48d1c
    description: string //"Log writer to AWS ES/Kibana"
}

export enum TDeploymentType {
    Deployer,
    Kubernetes,
    Infrastructure,
    Migration
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


export type TShepherdExtendedMetadata = TShepherdMetadata & {
    id: string
    herdSpec: THerdSpec
    deploymentState: TDeploymentState
    timestamp?: Date;
}


type THref = {
    title: string
    url: string
}




