import { expect } from "chai"
import * as fs from "fs"
import * as path from "path"
import { getDockerRegistryClientsFromConfig } from "./docker-registry-clients-config"

describe("Default docker registry clients config loading", function() {

  it("assumes shepherd API access is configured", () => {
    const configFileName = path.join(
      require("os").homedir(),
      ".docker",
      "config.json"
    )
    expect(fs.existsSync(configFileName)).to.equal(
      true,
      "This test assumes docker to be configured in " + configFileName
    )
  })

  it("loads default config for docker", () => {
    const config = getDockerRegistryClientsFromConfig()
    expect(Object.getOwnPropertyNames(config).length).to.be.gte(1)
  })

  it.only("should get metadata from private docker registry", () => {
    const config = getDockerRegistryClientsFromConfig()

    const api = config["isrvkbuild02:5000"]

    return api
      .getImageManifest("isrvkbuild02:5000/toyota-web", "68")
      .then((manifest: any) => {
        const expectedPropNames = [
          "schemaVersion",
          "name",
          "tag",
          "architecture",
          "fsLayers",
          "history",
          "signatures",
        ]
        expect(Object.getOwnPropertyNames(manifest)).to.eql(expectedPropNames)
      })
  })
})
