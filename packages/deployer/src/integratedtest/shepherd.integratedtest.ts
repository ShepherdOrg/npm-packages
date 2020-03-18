import * as _ from "lodash"

import { PgConfig, PostgresStore as PgBackend } from "@shepherdorg/postgres-backend"

import script from "../test-tools/script-test"
import { TFileSystemPath } from "../helpers/basic-types"
import { base64Encode } from "../template/base64-env-subst"
import { expect } from "chai"

const fs = require("fs")
const path = require("path")
const cleanDir = require("../test-tools/clean-dir")

function ensureCleanOutputFolder(firstRoundFolder: TFileSystemPath) {
  if (!fs.existsSync(firstRoundFolder)) {
    fs.mkdirSync(firstRoundFolder)
  }
  cleanDir(firstRoundFolder, false)
}

describe("running shepherd", function() {
  let shepherdTestHarness = path.join(process.cwd(), "testbin/test-shepherd.sh")

  this.timeout(40000)

  beforeEach(function() {
    if (!fs.existsSync("./.build/.testdata")) {
      fs.mkdirSync("./.build/.testdata")
    }
    if (!fs.existsSync("./.build/.testdata")) {
      fs.mkdirSync("./.build/.testdata")
    }
    if (!fs.existsSync("./.build/.testdata/actual")) {
      fs.mkdirSync("./.build/.testdata/actual")
    }
    cleanDir("./.build/.testdata/actual", false)
  })

  describe("default state storage", function() {
    beforeEach(() => {
      delete process.env.SHEPHERD_UI_API_ENDPOINT
      let shepherdStoreDir = "./.build/.shepherdstore"
      cleanDir(shepherdStoreDir)
    })

    it("should deploy everything", function(done) {
      script
        .execute(shepherdTestHarness, ["--dryrun"], {
          env: _.extend({}, process.env, {
            NO_REBUILD_IMAGES: true,
            SHEPHERD_PG_HOST: "",
            INFRASTRUCTURE_IMPORTED_ENV: "thatsme",
          }),
          debug: false, // debug:false suppresses stdout of process
        })
        .ignoreLinesWith(["buildDate", "lastCommits", "kubeConfigB64", "gitHash"])
        .output("./.build/.testdata/kubeapply")
        .shouldEqual("./src/integratedtest/expected/all-deployments")
        .done(function() {
          done()
        })
    })
  })

  describe("adding to herd", function() {

    let tempHerdFilePath = path.resolve("./.build/herd-for-editing.yaml")

    beforeEach(() => {
      let shepherdStoreDir = "./.build/.shepherdstore"
      cleanDir(shepherdStoreDir)
      cleanDir("./.build/.testdata/testexport", false)

      fs.copyFileSync("./src/herd-loading/testdata/herd-editing/herd.yaml", tempHerdFilePath)
    })


    it("should add deployment to herd", (done) => {
      script
        .execute(shepherdTestHarness, ["--dryrun", tempHerdFilePath], {
          env: _.extend({}, process.env, {
            NO_REBUILD_IMAGES: true,
            SHEPHERD_PG_HOST: "",
            UPSTREAM_IMAGE_URL: "testenvimage:0.0.0",
            UPSTREAM_HERD_KEY: "addedimage",
            UPSTREAM_HERD_DESCRIPTION: "Just a casual e2e test",
          }),
          debug: false, // debug:false suppresses stdout of process
        })
        .stdout()
        .shouldContain("Adding addedimage")
        .stdout()
        .shouldContain("Deploying addedimage")
        .stdout()
        .shouldContain("Executing deployment plan...")
        .stdout()
        .shouldContain("...plan execution complete")
        .done(function() {
          done()
        })
    })
  })

  describe("using fake kubectl", function() {
    const firstRoundFolder = path.join(process.cwd(), "./.build/kubeapply")
    const secondRoundFolder = path.join(
      process.cwd(),
      "./.build/kubeapply-secondround",
    )

    beforeEach(function() {
      if (!process.env.SHEPHERD_PG_HOST) {
        process.env.SHEPHERD_PG_HOST = "localhost"
      }
      process.env.RESET_FOR_REAL = "yes-i-really-want-to-drop-deployments-table"
      process.env.UPSTREAM_WAIT_FOR_ROLLOUT = "true"
      let pgBackend = PgBackend(PgConfig())

      ensureCleanOutputFolder(firstRoundFolder)
      ensureCleanOutputFolder(secondRoundFolder)

      let postgresConnectionError = (err: Error) => {
        throw new Error("Error connecting to postgres! Cause: " + err.message)
      }
      return pgBackend
        .connect().catch(postgresConnectionError)
        .then(() => pgBackend.resetAllDeploymentStates())
    })

    it("should deploy once in two runs", function(done) {
      process.env.KUBECTL_OUTPUT_FOLDER = firstRoundFolder

      let testEnv = { NO_REBUILD_IMAGES: true, INFRASTRUCTURE_IMPORTED_ENV: "thatsme" }
      script
        .execute(shepherdTestHarness, [], {
          env: _.extend(testEnv, process.env),
          debug: false, // debug:false suppresses stdout of process
        })
        .output(firstRoundFolder)
        .shouldEqual(process.cwd() + "/src/integratedtest/expected/k8s-deployments")
        .done(function(_stdout) {
          // console.log(`stdout`, stdout)
          process.env.KUBECTL_OUTPUT_FOLDER = secondRoundFolder

          script
            .execute(shepherdTestHarness, [], {
              env: _.extend(testEnv, process.env),
              debug: false, // debug:false suppresses stdout of process
            })
            .output(secondRoundFolder)
            .shouldBeEmptyDir()
            .done(function(_stdout) {
              done()
            })
        })
    })
  })

  describe("postDeployTest support", function() {

    beforeEach(() => {
      const firstRoundFolder = path.join(process.cwd(), "./.build/kubeapply")
      ensureCleanOutputFolder(firstRoundFolder)

      process.env.KUBECTL_OUTPUT_FOLDER = firstRoundFolder
      delete process.env.SHEPHERD_UI_API_ENDPOINT
      let shepherdStoreDir = "./.build/.shepherdstore"
      cleanDir(shepherdStoreDir)
    })

    it("should fail on post test and attempt to rollback to previous version, independently on deployment plans", function(done) {
      script
        .execute(shepherdTestHarness, ["--fakerun", "src/herd-loading/testdata/deploytestherd/herd.yaml"], {
          env: _.extend({}, process.env, {
            NO_REBUILD_IMAGES: true,
            SHEPHERD_PG_HOST: "",
            FAIL_POSTDEPLOY_TEST: true,
          }),
          debug: false, // debug:false suppresses stdout of process
        })
        .expectExitCode(255)
        .stdout().shouldContain("Executing docker command pretest")
        .stdout().shouldContain("Executing docker command deploy")
        .stdout().shouldContain("Executing docker command posttest")
        .stdout().shouldContain("Test run failed, rolling back to last good version.")
        .stdout().shouldContain("rollout undo deployment/deployment-one-to-roll-back FAKED ok")
        .stdout().shouldContain("Rollback complete. Original error follows.")
        .stdout().shouldContain('Post test failed')
        .stdout().shouldNotContain('not found')
        .done(function() {
          done()
        })
    })
  })

  xit("should execute infrastructure deployers first to completion", () => {
  })

  describe("with state storage", function() {
    beforeEach(function() {
      if (!process.env.SHEPHERD_PG_HOST) {
        process.env.SHEPHERD_PG_HOST = "localhost"
      }

      process.env.RESET_FOR_REAL = "yes-i-really-want-to-drop-deployments-table"
      let pgBackend = PgBackend(PgConfig())

      cleanDir("./.build/.testdata/testexport", false)

      return pgBackend
        .connect()
        .then(() => pgBackend.resetAllDeploymentStates()).catch((err: Error) => {
          throw new Error("Error connecting to postgres! Cause: " + err.message)
        })
    })


    it("should modify branch deployment", function(done) {
      script
        .execute(shepherdTestHarness, ["--dryrun"], {
          env: _.extend({
            NO_REBUILD_IMAGES: true,
            INFRASTRUCTURE_IMPORTED_ENV: "thatsme",
          }, process.env),
          debug: false, // debug:false suppresses stdout of process
        })
        .done(function() {
          done()
        })
    })

    const testEnv = {
      SHEPHERD_FILESTORE_DIR: "./.build/.shepherdstore",
      www_icelandair_com_image: "www-image:99",
      PREFIXED_TOP_DOMAIN_NAME: "testtopdomain",
      SUB_DOMAIN_PREFIX: "testSDP",
      WWW_ICELANDAIR_IP_WHITELIST: base64Encode("teststring"),
      DEBUG_MODE: "false",
      PERFORMANCE_LOG: "false",
      MICROSERVICES_POSTGRES_RDS_HOST: "postgres-local",
      MICRO_SITES_DB_PASSWORD: "somedbpass",
      ENV: "testit",
      EXPORT1: "nowhardcoded",
      NO_REBUILD_IMAGES: true,
    }

    beforeEach(function() {
      if (!fs.existsSync(".build")) {
        fs.mkdirSync(".build")
      }
      if (!fs.existsSync(".build/testexport")) {
        fs.mkdirSync(".build/testexport")
      }
      cleanDir(".build/testexport", false)
    })

    it("should export deployment documents directly", function(done) {
      let expectedOutputFileOrDir =
        process.cwd() + "/src/integratedtest/expected/exported"
      script
        .execute(
          "./dist/shepherd.js",
          [
            "./src/herd-loading/testdata/happypath/herd.yaml",
            "integratedtestenv",
            "--export",
            "--outputDir",
            ".build/testexport",
          ],
          {
            env: _.extend({
              GLOBAL_MIGRATION_ENV_VARIABLE_ONE: "justAValue",
              INFRASTRUCTURE_IMPORTED_ENV: "thatsme",
            }, testEnv, process.env),
            debug: false, // debug:false suppresses stdout of process
          },
        )
        .output(".build/testexport")
        .shouldEqual(expectedOutputFileOrDir)
        .done(function() {
          done()
        })
    })
  })
})
