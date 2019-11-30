import { expect } from "chai"
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

      it("loads specified config file", () => {
        expect(Object.getOwnPropertyNames(config).length).to.be.gt(2, Object.getOwnPropertyNames(config).join(", "))
      })

      it("should load certificates found in .shepherd/certs.d", () => {
        expect(config["localhost:4400"].getCertificate()).not.to.equal(undefined)
      })

      it("should add certificates found in .shepherd/certs.d to config.json definitions", () => {
        expect(config["localhost:5500"].getCertificate()).not.to.equal(undefined)
      })
    })

    describe("no .docker/config.json file found", function() {
      let config: TDockerRegistryClientMap

      before(() => {
        config = getDockerRegistryClientsFromConfig({ homeDir: "src", log: testCaseLogger })
      })

      it("should return empty config", () => {
        expect(Object.getOwnPropertyNames(config).length).to.be.equal(0)
      })
    })
  })
})
