import { strict as assert } from "node:assert"
import { describe, it, before, beforeEach } from "node:test"
import { getDockerRegistryClientsFromConfig, TDockerRegistryClientMap } from "./docker-registry-clients-config"
import { getTestCaseLogger, ITestLog } from "./testcase-logger"

describe("Registry clients config loading", function() {
  let testCaseLogger: ITestLog

  beforeEach(() => {
    testCaseLogger = getTestCaseLogger({ debugOutput: false, infoOutput: false, warnOutput: true })
  })

  describe("config file loading from fakehomdir", function() {
    let config: TDockerRegistryClientMap

    before(() => {
      config = getDockerRegistryClientsFromConfig({
        homeDir: "testing/fakehomedir",
        log: testCaseLogger,
      })
    })

    it("loads specified config file", () => {
      assert.ok(Object.getOwnPropertyNames(config).length > 2)
    })

    it("should load certificates found in .shepherd/certs.d", () => {
      assert.notStrictEqual(config["localhost:4400"].getCertificate(), undefined)
    })

    it("should add certificates found in .shepherd/certs.d to config.json definitions", () => {
      assert.notStrictEqual(config["localhost:5500"].getCertificate(), undefined)
    })


    describe("no .docker/config.json file found", function() {
      let config: TDockerRegistryClientMap

      before(() => {
        config = getDockerRegistryClientsFromConfig({ homeDir: "src", log: testCaseLogger })
      })

      it("should return empty config", () => {
        assert.strictEqual(Object.getOwnPropertyNames(config).length, 0)
      })
    })
  })
})
