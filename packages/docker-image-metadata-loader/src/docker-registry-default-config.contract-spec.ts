import {expect} from "chai";
import * as fs from "fs";
import * as path from "path";
import {getDockerRegistryClientsFromConfig} from "./docker-registry-clients-config";

describe("Default docker registry clients config loading", function () {

    it("assumes docker is configured", () => {
        const configFileName = path.join(require('os').homedir(), '.docker', 'config.json');
        expect(fs.existsSync(configFileName)).to.equal(true, 'This test assumes docker to be configured');
    });

    it("loads default config for docker", () => {
        const config = getDockerRegistryClientsFromConfig()
        expect(Object.getOwnPropertyNames(config).length).to.be.gte(1)
    });

});