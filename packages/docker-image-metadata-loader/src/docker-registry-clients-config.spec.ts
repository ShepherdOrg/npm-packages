import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { getDockerRegistryClientsFromConfig } from "./docker-registry-clients-config";

describe("Registry clients config loading", function() {

  describe("default file loading", function() {

    it("assumes docker is configured", () => {
      const configFileName = path.join(require('os').homedir(),'.docker', 'config.json');
      expect(fs.existsSync(configFileName)).to.equal(true,'This test assumes docker to be configured');
    });

    it("loads default config for docker", () => {
      const config = getDockerRegistryClientsFromConfig()
      expect(Object.getOwnPropertyNames(config).length).to.be.gte(1)
    });


    it("loads specified config file", () => {
      const config = getDockerRegistryClientsFromConfig('testing/docker-config/config.json')
      expect(Object.getOwnPropertyNames(config).length).to.be.equal(2)
    });

    it("should return empty config if config file is not found", () => {
      const config = getDockerRegistryClientsFromConfig('testing/docker-config/nonexisting.json')
      expect(Object.getOwnPropertyNames(config).length).to.be.equal(0)
    });

  });

});