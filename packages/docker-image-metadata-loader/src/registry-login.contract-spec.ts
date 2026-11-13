import { initRegistryLogin } from "./registry-login"
import { getDockerRegistryClientsFromConfig, TDockerRegistryClientMap } from "./docker-registry-clients-config"
import { strict as assert } from "node:assert"
import { describe, it, before } from "node:test"


if(Boolean(process.env.DOCKER_REGISTRY_USERNAME)){
  describe("docker registry basicauth login", function() {

    const registryLogin = initRegistryLogin({homeDir: './build'})

    it.skip("should try first on http and then on https", async () => {
      let userName = process.env.DOCKER_REGISTRY_USERNAME || ''
      let password = process.env.DOCKER_REGISTRY_PASSWORD || ''
      let registryHost = process.env.DOCKER_REGISTRY_HOST || ''
      await registryLogin.registryLogin(registryHost, userName, password)
    })
  })
}

describe("saving credentials", function() {

  let registryClients: TDockerRegistryClientMap

  before(()=>{
    const registryLogin = initRegistryLogin({homeDir: './build'})
    registryLogin.saveRegistryCredentials('https', 'somewhere.else', 'badToken')
    registryLogin.saveRegistryCredentials('https', 'another.registry', 'badToken')

    registryClients = getDockerRegistryClientsFromConfig({ homeDir: "./build", log: console })
  })

  it("should have registry clients for credentials saved", () => {
    assert.strictEqual(Object.keys(registryClients).length, 2)
  })

})
