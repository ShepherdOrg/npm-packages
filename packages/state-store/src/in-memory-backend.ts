import { IStorageBackend } from "./index"

interface IInMemoryStorageBackend extends IStorageBackend {
  store(): any
  resetAllDeploymentStates():void
}
const wait = (ms: number) => new Promise(res => setTimeout(res, ms))

type TAnyMap = { [key: string]: any }

export function InMemoryStore(): IInMemoryStorageBackend {
  let store : TAnyMap = {}
  return {
    async connect():Promise<void> {
      await wait(0)
      // Noop
    },
    async disconnect():Promise<void> {
      await wait(0)
      // Noop
    },
    resetAllDeploymentStates() {
      store = {}
    },
    async set(key, value) {
      await wait(0)
      store[key] = value
      return { key, value }
    },
    async get(key) {
      await wait(0)
      return { key, value: store[key] }
    },
    store: function() {
      return store
    },
  }
}
