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
    resetAllDeploymentStates()
}

export type TStateStoreDependencies = {
    storageBackend: IStorageBackend
}


