import { IStorageBackend } from "./index"

interface IInMemoryStorageBackend extends IStorageBackend {
  store(): any
  resetAllDeploymentStates()
}
const wait = (ms: number) => new Promise(res => setTimeout(res, ms))

export function InMemoryStore(): IInMemoryStorageBackend {
  let store = {}
  return {
    connect() {
      // Noop
    },
    disconnect() {
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
