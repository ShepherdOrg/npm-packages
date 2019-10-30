import { expect } from "chai"
import { getDockerRegistryClientsFromConfig } from "./docker-registry-clients-config"

describe("Registry clients config loading", function() {
  describe("config file loading", function() {
    it("loads specified config file", () => {
      const config = getDockerRegistryClientsFromConfig(
        "testing/docker-config/config.json"
      )
      expect(Object.getOwnPropertyNames(config).length).to.be.equal(2)
    })

    it("should return empty config if config file is not found", () => {
      const config = getDockerRegistryClientsFromConfig(
        "testing/docker-config/nonexisting.json"
      )
      expect(Object.getOwnPropertyNames(config).length).to.be.equal(0)
    })
  })
})
