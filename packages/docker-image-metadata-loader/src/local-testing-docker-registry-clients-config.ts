import { createDockerRegistryClient } from "./registry-metadata-client"
import { TDockerRegistryClientMap } from "./docker-registry-clients-config"

export function getLocalhostTestingDockerRegistryClients(): TDockerRegistryClientMap {
  return {
    "localhost:5000": createDockerRegistryClient({
      httpProtocol: "http",
      registryHost: "localhost:5000",
    }),
    "localhost:5500": createDockerRegistryClient({
      httpProtocol: "https",
      registryHost: "localhost:5500",
      authorization: {
        type: "Basic",
        token: "dGVzdHVzZXI6dGVzdHBhc3N3b3Jk",
      },
    }),
  }
}
