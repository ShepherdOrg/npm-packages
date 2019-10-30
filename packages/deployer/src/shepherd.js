#!/usr/bin/env node
"use strict"
let path = require("path")
let fs = require("fs")

let CreatePushApi = require('@shepherdorg/ui-push').CreatePushApi
/*
This is the main entry point for shepherd deployer agent
 */

function printUsage() {
  console.log(`Usage: shepherd /path/to/a/herd.yaml ENVIRONMENT <options>

Supported options:

    --export
    --dryrun
    
    
Both will write to directory specified by 
    --outputDir <directory>
 
Options through environment variables:

    SHEPHERD_PG_HOST         - Postgres host
    SHEPHERD_FILESTORE_DIR   - Directory if using filestore (not recommended for production)
    SHEPHERD_UI_API_ENDPOINT - GraphQL endpoint for shepherd UI API
`)
}

// parse options - Accept dry-run flags

global.inject = require("@shepherdorg/nano-inject").inject
global._ = require("lodash")
global.Promise = require("bluebird")

let Logger = require("./deployment-manager/logger")

const logger = Logger(console)

console.debug = function() {
  // Array.prototype.unshift.call(arguments, 'SHEPDEBUG ');
  // console.log.apply(console, arguments);
}

let dryRun = process.argv.indexOf("--dryrun") > 0

const exportDocuments = process.argv.indexOf("--export") > 0

let outputDirectory

if (process.argv.indexOf("--help") > 0) {
  printUsage()
  process.exit(0)
}

if (process.argv.indexOf("--outputDir") > 0) {
  outputDirectory = process.argv[process.argv.indexOf("--outputDir") + 1]
  logger.info("Writing deployment documents to " + outputDirectory)

  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory)
  }
}

if ((exportDocuments || dryRun) && !outputDirectory) {
  console.error("Must specify output dir in export and dryrun modes with --outputDir parameter")
  process.exit(-1)
}

let stateStoreBackend

if (process.env.SHEPHERD_PG_HOST) {
  const pgConfig = require("@shepherdorg/postgres-backend").PgConfig()
  const PostgresStore = require("@shepherdorg/postgres-backend").PostgresStore
  stateStoreBackend = PostgresStore(pgConfig)
} else {
  const FileStore = require("@shepherdorg/filestore-backend").FileStore
  let homedir = require("os").homedir()
  let shepherdStoreDir =
    process.env.SHEPHERD_FILESTORE_DIR || path.join(homedir, ".shepherdstore", process.env.ENV || "default")
  logger.info("WARNING: Falling back to file based state store directory in ", shepherdStoreDir)
  stateStoreBackend = FileStore({ directory: shepherdStoreDir })
}
if(Boolean(process.env.SHEPHERD_UI_API_ENDPOINT)){
  const uiBackend = CreatePushApi(process.env.SHEPHERD_UI_API_ENDPOINT)
}


const ReleaseStateStore = require("@shepherdorg/state-store").ReleaseStateStore
const HerdLoader = require("./deployment-manager/herd-loader")
const ReleasePlanModule = require("./deployment-manager/release-plan")
const exec = require("@shepherdorg/exec")

function terminateProcess(exitCode) {
  stateStoreBackend.disconnect()
  process.exit(exitCode)
}

stateStoreBackend
  .connect()
  .then(function() {
    let releaseStateStore = ReleaseStateStore({
      storageBackend: stateStoreBackend,
    })

    const ReleasePlan = ReleasePlanModule(
      inject({
        cmd: exec,
        logger: Logger(console),
        stateStore: releaseStateStore,
      })
    )

    let loader = HerdLoader(
      inject({
        logger: Logger(console),
        ReleasePlan: ReleasePlan,
        exec: exec,
      })
    )

    let herdFilePath = process.argv[2]
    let environment = process.argv[3]

    if (!environment) {
      return printUsage()
    }

    logger.info("Shepherding herd from file " + herdFilePath + " for environment " + environment)
    loader
      .loadHerd(herdFilePath, environment)
      .then(function(plan) {
        plan.printPlan(logger)
        if (exportDocuments) {
          logger.info("Testrun mode set - exporting all deployment documents to " + outputDirectory)
          logger.info("Testrun mode set - no deployments will be performed")
          plan
            .exportDeploymentDocuments(outputDirectory)
            .then(function() {
              terminateProcess(0)
            })
            .catch(function(writeError) {
              logger.error("Error exporting deployment document! ", writeError)
              terminateProcess(-1)
            })
        } else {
          plan
            .executePlan({ dryRun: dryRun, dryRunOutputDir: outputDirectory, uiBackend: uiBackend })
            .then(function() {
              logger.info("Plan execution complete. Exiting shepherd.")
              setTimeout(() => {
                terminateProcess(0)
              }, 1000)
            })
            .catch(function(err) {
              logger.error("Plan execution error", err)
              terminateProcess(-1)
            })
        }
      })
      .catch(function(loadError) {
        logger.error("Plan load error.", loadError)
        stateStoreBackend.disconnect()
        process.exit(-1)
      })
  })
  .catch(function(err) {
    console.error("Connection/migration error", err)
    process.exit(-1)
  })
