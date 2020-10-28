import { createDockerRegistryClient, IRetrieveDockerImageLabels } from "./registry-metadata-client"
import * as _ from "lodash"
import * as path from "path"
import * as fs from "fs"
import { ILog } from "./index"

export type TDockerRegistryClientMap = {
  [hostname: string]: IRetrieveDockerImageLabels
}

function dockerConfigFilePath(homeDir) {
  return path.join(homeDir, ".docker", "config.json")
}

export function shepherdRegistriesConfigFilePath(homeDir) {
  return path.join(homeDir, ".shepherd", "registries.json")
}

interface TDockerRegistryConfigOptions {
  log: ILog,
  homeDir: string
}

const defaultOptions: TDockerRegistryConfigOptions = {
  homeDir: require("os").homedir(),
  log: console,
}

export function getDockerRegistryClientsFromConfig(options: TDockerRegistryConfigOptions = defaultOptions,
): TDockerRegistryClientMap {

  const configFilePath = path.resolve(dockerConfigFilePath(options.homeDir))
  let clients: TDockerRegistryClientMap = {}

  let dockerConfig: any = {}

  if (fs.existsSync(configFilePath)) {
    dockerConfig = JSON.parse(fs.readFileSync(configFilePath, "utf8"))
  }

  let registriesConfigFilePath = shepherdRegistriesConfigFilePath(options.homeDir)
  let registriesConfig: any

  if (fs.existsSync(registriesConfigFilePath)) {
    registriesConfig = JSON.parse(fs.readFileSync(registriesConfigFilePath, "utf8"))
  } else {
    registriesConfig = {}
  }

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
  _.each(registriesConfig, (registryConfig, hostName) => {
    if (registryConfig.authToken) {
      clients[hostName] = createDockerRegistryClient({
        httpProtocol: registryConfig.protocol,
        registryHost: hostName,
        authorization: { type: "Basic", token: registryConfig.authToken },
      })
    } else {
      clients[hostName] = createDockerRegistryClient({
        httpProtocol: registryConfig.protocol,
        registryHost: hostName,
      })
    }
  })

  const certsDir = path.join(options.homeDir, ".shepherd", "certs.d")
  if (fs.existsSync(certsDir) && fs.statSync(certsDir).isDirectory()) {
    fs.readdirSync(certsDir).map((certDir) => {
      let certFilePath = path.join(certsDir, certDir, "ca.crt")
      if (fs.existsSync(certFilePath)) {
        let ca = fs.readFileSync(certFilePath, "utf8")
        if (clients[certDir]) {
          clients[certDir].addCertificate(ca)
        } else {
          clients[certDir] = createDockerRegistryClient({
            httpProtocol: "https",
            registryHost: certDir,
            ca: ca,
          })
        }

      } else {
        options.log && options.log.warn("Probable misconfiguration: Directory listed in certs.d, but no ca.crt file found" + path.join(certsDir, certDir))
      }
    })
  }

  return clients
}

