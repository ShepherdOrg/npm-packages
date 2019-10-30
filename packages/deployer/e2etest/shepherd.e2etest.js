const script = require("../src/test-tools/script-test")
const fs = require("fs")
const path = require("path")
const _ = require("lodash")

const PgBackend = require("@shepherdorg/postgres-backend").PostgresStore
const PgConfig = require("@shepherdorg/postgres-backend").PgConfig

const cleanDir = require("../src/test-tools/clean-dir")

function ensureCleanOutputFolder(firstRoundFolder) {
  if (!fs.existsSync(firstRoundFolder)) {
    fs.mkdirSync(firstRoundFolder)
  }
  cleanDir(firstRoundFolder, false)
}

describe("run all deployers with infrastructure", function() {
  let shepherdTestHarness = __dirname + "/test-shepherd.sh"

  this.timeout(40000)

  beforeEach(function() {
    if (!fs.existsSync("./.testdata")) {
      fs.mkdirSync("./.testdata")
    }
    if (!fs.existsSync("./.testdata/.build")) {
      fs.mkdirSync("./.testdata/.build")
    }
    if (!fs.existsSync("./.testdata/.build/actual")) {
      fs.mkdirSync("./.testdata/.build/actual")
    }
    cleanDir("./.testdata/.build/actual", false)
  })

  describe("default state storage", function() {
    beforeEach(() => {
      let shepherdStoreDir = "./.build/.shepherdstore"
      cleanDir(shepherdStoreDir)
    })

    it("should deploy everything", function(done) {
      script
        .execute(shepherdTestHarness, ["--dryrun"], {
          env: _.extend({}, process.env, {
            NO_REBUILD_IMAGES: true,
            SHEPHERD_PG_HOST: "",
          }),
          debug: false, // debug:false suppresses stdout of process
        })
        .output("./.testdata/.build/kubeapply")
        .shouldEqual("./e2etest/expected/all-deployments")
        .done(function(stdout) {
          done()
        })
    })
  })

  describe("using fake kubectl", function() {
    const firstRoundFolder = path.join(process.cwd(), "./.build/kubeapply")
    const secondRoundFolder = path.join(
      process.cwd(),
      "./.build/kubeapply-secondround"
    )

    beforeEach(function() {
      if (!process.env.SHEPHERD_PG_HOST) {
        process.env.SHEPHERD_PG_HOST = "localhost"
      }
      process.env.RESET_FOR_REAL = "yes-i-really-want-to-drop-deployments-table"
      let pgBackend = PgBackend(PgConfig())

      ensureCleanOutputFolder(firstRoundFolder)
      ensureCleanOutputFolder(secondRoundFolder)

      return pgBackend
        .connect()
        .then(() => pgBackend.resetAllDeploymentStates())
    })

    it("should deploy once in two runs", function(done) {
      process.env.KUBECTL_OUTPUT_FOLDER = firstRoundFolder

      script
        .execute(shepherdTestHarness, [], {
          env: _.extend({ NO_REBUILD_IMAGES: true }, process.env),
          debug: false, // debug:false suppresses stdout of process
        })
        .output(firstRoundFolder)
        .shouldEqual(process.cwd() + "/e2etest/expected/k8s-deployments")
        .done(function(stdout) {
          process.env.KUBECTL_OUTPUT_FOLDER = secondRoundFolder

          script
            .execute(shepherdTestHarness, [], {
              env: _.extend({ NO_REBUILD_IMAGES: true }, process.env),
              debug: false, // debug:false suppresses stdout of process
            })
            .output(secondRoundFolder)
            .shouldBeEmptyDir()
            .done(function(stdout) {
              done()
            })
        })
    })
  })

  describe("with state storage", function() {
    beforeEach(function() {
      if (!process.env.SHEPHERD_PG_HOST) {
        process.env.SHEPHERD_PG_HOST = "localhost"
      }

      process.env.RESET_FOR_REAL = "yes-i-really-want-to-drop-deployments-table"
      let pgBackend = PgBackend(PgConfig())

      cleanDir("./.testdata/.build/testexport", false)

      return pgBackend
        .connect()
        .then(() => pgBackend.resetAllDeploymentStates())
    })

    it("should modify feature deployment", function(done) {
      script
        .execute(shepherdTestHarness, ["--dryrun"], {
          env: _.extend({ NO_REBUILD_IMAGES: true }, process.env),
          debug: false, // debug:false suppresses stdout of process
        })
        .done(function(stdout) {
          // process.env.DRYRUN_OUTPUT_FOLDER = './.testdata/.build/kubeapply-secondround';
          done()
        })
    })

    function base64Encode(teststring) {
      return Buffer.from(teststring).toString("base64")
    }

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
        process.cwd() + "/e2etest/expected/all-deployments"
      script
        .execute(
          "./src/shepherd.js",
          [
            "./src/deployment-manager/testdata/happypath/herd.yaml",
            "e2etestenv",
            "--export",
            "--outputDir",
            ".build/testexport",
          ],
          {
            env: _.extend({}, testEnv, process.env),
            debug: false, // debug:false suppresses stdout of process
          }
        )
        .output(".build/testexport")
        .shouldEqual(expectedOutputFileOrDir)
        .done(function(stdout) {
          done()
        })
    })
  })
})
