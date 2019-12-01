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

interface TDockerRegistryConfigOptions {
  log: ILog,
  homeDir: string
}

const defaultOptions:TDockerRegistryConfigOptions = {
  homeDir: require("os").homedir(),
  log: console
}

export function getDockerRegistryClientsFromConfig(options: TDockerRegistryConfigOptions = defaultOptions

): TDockerRegistryClientMap {

  const configFilePath = path.resolve(dockerConfigFilePath(options.homeDir))
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
  const certsDir = path.join(options.homeDir,'.shepherd', 'certs.d')
  if(fs.existsSync(certsDir) && fs.statSync(certsDir).isDirectory()){
    fs.readdirSync(certsDir).map((certDir)=>{
      let certFilePath = path.join(certsDir, certDir, 'ca.crt')
      if(fs.existsSync(certFilePath)){
        let ca = fs.readFileSync(certFilePath, 'utf8')
        if(clients[certDir]){
          clients[certDir].addCertificate(ca)
        } else{
          clients[certDir] = createDockerRegistryClient({
            httpProtocol: "https",
            registryHost: certDir,
            ca: ca
          })
        }

      } else {
        options.log && options.log.warn('Probable misconfiguration: Directory listed in certs.d, but no ca.crt file found' + path.join(certsDir, certDir))
      }
    })
  }

  return clients
}

