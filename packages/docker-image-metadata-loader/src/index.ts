export {
  getDockerRegistryClientsFromConfig,
} from "./docker-registry-clients-config"

export type ILog = {
  info: typeof console.info
  debug: typeof console.debug
  warn: typeof console.warn
}

export * from "./image-labels-loader"
