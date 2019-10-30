import { TDeploymentState } from "@shepherdorg/metadata/dist"

export { ReleaseStateStore } from "./state-store"

export interface IStorageBackend {
  get(key: string): Promise<{ key: string; value: TDeploymentState }>

  set(
    key: any,
    timestampedObject: TDeploymentState
  ): Promise<{ key: string; value: TDeploymentState }> // Maybe have explicit type on this later, tests not compatible right now.

  connect()

  disconnect()
}

export type TStateStoreDependencies = {
  storageBackend: IStorageBackend
}
