const script = require("../test-tools/script-test")
const fs = require("fs")
const path = require("path")
const _ = require("lodash")

const PgBackend = require("@shepherdorg/postgres-backend").PostgresStore
const PgConfig = require("@shepherdorg/postgres-backend").PgConfig

const cleanDir = require("../test-tools/clean-dir")

function ensureCleanOutputFolder(firstRoundFolder) {
  if (!fs.existsSync(firstRoundFolder)) {
    fs.mkdirSync(firstRoundFolder)
  }
  cleanDir(firstRoundFolder, false)
}

describe("run all deployers with infrastructure", function() {
  let shepherdTestHarness = process.cwd() + "/src/e2etest/test-shepherd.sh"

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
        .output("./.build/.testdata/kubeapply")
        .shouldEqual("./src/e2etest/expected/all-deployments")
        .done(function() {
          done()
        })
    })
  })

  describe("adding to herd", function() {

    let tempHerdFilePath = path.resolve('./.build/herd-for-editing.yaml')

    beforeEach(() => {
      let shepherdStoreDir = "./.build/.shepherdstore"
      cleanDir(shepherdStoreDir)
      cleanDir("./.build/.testdata/testexport", false)

      fs.copyFileSync('./src/deployment-manager/testdata/herd-editing/herd.yaml', tempHerdFilePath)
    })


    it("should add deployment to herd", (done) => {
      script
        .execute(shepherdTestHarness, ["--dryrun", tempHerdFilePath], {
          env: _.extend({}, process.env, {
            NO_REBUILD_IMAGES: true,
            SHEPHERD_PG_HOST: "",
            UPSTREAM_IMAGE_NAME:"testenvimage",
            UPSTREAM_IMAGE_TAG:"0.0.0",
            UPSTREAM_HERD_KEY:'addedimage',
            UPSTREAM_HERD_DESCRIPTION:'Just a casual e2e test'
          }),
          debug: false, // debug:false suppresses stdout of process
        })
        .stdout()
        .shouldContain('Adding addedimage')
        .stdout()
        .shouldContain('From addedimage')
        .stdout()
        .shouldContain('Plan execution complete')
        .done(function() {
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
        .shouldEqual(process.cwd() + "/src/e2etest/expected/k8s-deployments")
        .done(function() {
          process.env.KUBECTL_OUTPUT_FOLDER = secondRoundFolder

          script
            .execute(shepherdTestHarness, [], {
              env: _.extend({ NO_REBUILD_IMAGES: true }, process.env),
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
        .then(() => pgBackend.resetAllDeploymentStates())
    })

    it("should modify feature deployment", function(done) {
      script
        .execute(shepherdTestHarness, ["--dryrun"], {
          env: _.extend({ NO_REBUILD_IMAGES: true }, process.env),
          debug: false, // debug:false suppresses stdout of process
        })
        .done(function() {
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
      console.log('process.cwd()', process.cwd())
      let expectedOutputFileOrDir =
        process.cwd() + "/src/e2etest/expected/all-deployments"
      script
        .execute(
          "./dist/shepherd.js",
          [
            "./src/deployment-manager/testdata/happypath/herd.yaml",
            "e2etestenv",
            "--export",
            "--outputDir",
            ".build/testexport",
          ],
          {
            env: _.extend({
              GLOBAL_MIGRATION_ENV_VARIABLE_ONE:'justAValue'
            }, testEnv, process.env),
            debug: false, // debug:false suppresses stdout of process
          }
        )
        .output(".build/testexport")
        .shouldEqual(expectedOutputFileOrDir)
        .done(function() {
          done()
        })
    })
  })
})
