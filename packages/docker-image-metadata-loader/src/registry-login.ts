import { createDockerRegistryClient } from "./registry-metadata-client"
import * as fs from "fs"
import * as path from "path"
import { shepherdRegistriesConfigFilePath } from "./docker-registry-clients-config"


export type TRegistryLoginOptions = {
  homeDir: string
}

export function initRegistryLogin(options: TRegistryLoginOptions){

  async function checkCredentials(protocol: string, registryHost: string, bufferToken: string): Promise<boolean> {
    const registryClient = createDockerRegistryClient({
      httpProtocol: protocol,
      registryHost: registryHost,
      authorization: {
        type: "Basic",
        token: bufferToken,
      },
    })

    try {
      await registryClient.verifyVersion("v2")
      return true
    } catch (err) {
      return false

    }
  }

  function saveRegistryCredentials(protocol: string, registryHost: string, authToken: string) {

    let configFilePath = shepherdRegistriesConfigFilePath(options.homeDir)
    if(!fs.existsSync(path.dirname(configFilePath))){
      fs.mkdirSync(path.dirname(configFilePath), {recursive: true})
    }
    let registryAuths = {
    }

    if(fs.existsSync(configFilePath)){
      registryAuths = JSON.parse(fs.readFileSync(configFilePath, 'utf8'))
    }
    registryAuths[registryHost] = {
      protocol,
      authToken
    }

    let registryAuthsStr = JSON.stringify(registryAuths)

    fs.writeFileSync(configFilePath, registryAuthsStr)
    return registryAuths
  }

  /** Check credientials and save them if they are valid.
   * @returns true if valid and saved, false otherwise
   */
  async function checkAndSaveCredentials(protocol: string, registryHost: string, username: string, password: string):Promise<boolean> {
    let authToken: string = Buffer.from(`${username}:${password}`).toString('base64')
    const loginSuccess = await checkCredentials(protocol, registryHost, authToken)
    if (loginSuccess) {
      saveRegistryCredentials(protocol, registryHost, authToken)
    }
    return loginSuccess
  }

  async function registryLogin(registryHost: string, userName: string, password: string):Promise<boolean> {
    if (!await checkAndSaveCredentials("http", registryHost, userName, password)) {
      return await checkAndSaveCredentials("https", registryHost, userName, password)
    }
    return true
  }

  return {
    registryLogin,
    saveRegistryCredentials
  }

}


