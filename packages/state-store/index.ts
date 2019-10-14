export {ReleaseStateStore} from './state-store'

export interface IStorageBackend {
    get(key: string): any

    set(key: any, timestampedObject: any): any
}

export type TStateStoreDependencies = {
    storageBackend: IStorageBackend
}
