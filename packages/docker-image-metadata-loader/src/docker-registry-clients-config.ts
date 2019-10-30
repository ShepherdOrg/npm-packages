import {
  createDockerRegistryClient,
  IRetrieveDockerImageLabels,
} from "./registry-metadata-client"
import * as _ from "lodash"
import * as path from "path"
import * as fs from "fs"

export type TDockerRegistryClientMap = {
  [hostname: string]: IRetrieveDockerImageLabels
}

function defaultDockerConfig() {
  const homeDir = require("os").homedir()
  return path.join(homeDir, ".docker", "config.json")
}

export function getDockerRegistryClientsFromConfig(
  configFile: string = defaultDockerConfig()
): TDockerRegistryClientMap {
  const configFilePath = path.resolve(configFile)
  let clients: TDockerRegistryClientMap = {}

  if (!fs.existsSync(configFilePath)) {
    return clients
  }
  const dockerConfig: any = JSON.parse(fs.readFileSync(configFilePath, "utf8"))

  if (dockerConfig.auths) {
    _.each(dockerConfig.auths, (auth, hostName) => {
      if (auth.auth) {
        clients[hostName] = createDockerRegistryClient({
          httpProtocol: "https",
          registryHost: hostName,
          authorization: { type: "Basic", token: auth.auth },
        })
      } else {
        clients[hostName] = createDockerRegistryClient({
          httpProtocol: "http",
          registryHost: hostName,
        })
      }
    })
  }

  return clients
}

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
