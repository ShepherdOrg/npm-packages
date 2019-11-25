#!/usr/bin/env node
"use strict"
import * as path from "path"

import * as fs from "fs"
import { inject } from "@shepherdorg/nano-inject/dist"
import { ReleasePlanModule } from "./deployment-manager/release-plan"

let CreatePushApi = require("@shepherdorg/ui-push").CreatePushApi

/*
This is the main entry point for shepherd deployer agent
 */

function printUsage () {
  console.info(`Usage: shepherd /path/to/a/herd.yaml ENVIRONMENT <options>

Supported options:

    --export             Export deployment documents to outputDir
    --dryrun             Run without actually deploying. Exports documents to outputDir. 
    --force-push         Force push of deployment data to consumers during --dryrun (this is not git push)
    --wait-for-rollout   Wait for any kubernetes deployment rollouts to complete before determining successful deployment. 
                         Shepherd does not wait for rollouts by default.
    
    
Both will write to directory specified by 
    --outputDir <directory>
 
Options through environment variables:

Upstream build job input. The first three must be provided together or all skipped.    
    UPSTREAM_HERD_KEY           - Herd key from upstream trigger. Equivalent to key in images section in herd.yaml
    UPSTREAM_IMAGE_NAME         - Docker image name from upstream. Always without tag. 
    UPSTREAM_IMAGE_TAG          - Docker image tag from upstream trigger. 
    UPSTREAM_HERD_DESCRIPTION   - Short description that would otherwise be in the herd.yaml file.
    UPSTREAM_WAIT_FOR_ROLLOUT   - Upstream build wants rollout to complete before getting control back. Designed for e2e tests.

Push ata Shepherd UI:
    SHEPHERD_UI_API_ENDPOINT - GraphQL endpoint for shepherd UI API
        Example: SHEPHERD_UI_API_ENDPOINT=http://localhost:8080/v1/graphql

Deployment state store configuration

  When using file store:
    SHEPHERD_FILESTORE_DIR   - Directory if using filestore (not recommended for production)

  When using postgres state store config:
    SHEPHERD_PG_HOST         - Postgres host
    SHEPHERD_PG_PORT         - Postgres port, default: 5432
    SHEPHERD_PG_USER         - Postgres user 
    SHEPHERD_PG_DATABASE     - Postgres database
    SHEPHERD_PG_PASSWORD     - Postgres password

`)
}

if (process.argv.indexOf("--help") > 0) {
  printUsage()
  process.exit(0)
}

function printVersions() {
  console.info(`deployer v${require("../package.json").version}`)
  console.info(`metadata v${require("@shepherdorg/metadata/package").version}`)
}

if (process.argv.indexOf("--version") > 0) {
  printVersions()
  process.exit(0)
}

// parse options - Accept dry-run flags

// @ts-ignore
global.inject = require("@shepherdorg/nano-inject").inject
// @ts-ignore
global._ = require("lodash")
global.Promise = require("bluebird")

let Logger = require("./deployment-manager/logger")

const logger = Logger(console)

console.debug = function() {
  // Array.prototype.unshift.call(arguments, 'SHEPDEBUG ');
  // console.log.apply(console, arguments);
}

let dryRun = process.argv.indexOf("--dryrun") > 0
let forcePush = process.argv.indexOf("--force-push") > 0
let waitForRollout = process.env.UPSTREAM_WAIT_FOR_ROLLOUT === "true" || process.argv.indexOf("--wait-for-rollout") > 0


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
  process.exit(255)
}

let stateStoreBackend
let uiDataPusher

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
if (Boolean(process.env.SHEPHERD_UI_API_ENDPOINT)) {
  console.info(`Shepherd UI API endpoint configured ${process.env.SHEPHERD_UI_API_ENDPOINT}`)
  uiDataPusher = CreatePushApi(process.env.SHEPHERD_UI_API_ENDPOINT, console)
}

const ReleaseStateStore = require("@shepherdorg/state-store").ReleaseStateStore
const HerdLoader = require("./deployment-manager/herd-loader")

const exec = require("@shepherdorg/exec")
const { CreateUpstreamTriggerDeploymentConfig } = require("./deployment-manager/create-upstream-trigger-deployment-config")

const upgradeOrAddDeploymentInFile = require("./herd-file/herd-edit").upgradeOrAddDeploymentInFile

function terminateProcess(exitCode) {
  stateStoreBackend.disconnect()
  process.exit(exitCode)
}

let herdFilePath = process.argv[2]
let environment = process.argv[3]


stateStoreBackend
  .connect()
  .then(function() {
    let releaseStateStore = ReleaseStateStore({
      storageBackend: stateStoreBackend,
    })

    const featureDeploymentConfig = CreateUpstreamTriggerDeploymentConfig(logger)
    featureDeploymentConfig.loadFromEnvironment(herdFilePath, process.env)

    const ReleasePlan = ReleasePlanModule(
      {
        cmd: exec,
        logger: Logger(console),
        stateStore: releaseStateStore,
        uiDataPusher: uiDataPusher,
      }
    )

    if(featureDeploymentConfig.herdFileEditNeeded()){
      upgradeOrAddDeploymentInFile(featureDeploymentConfig, logger)
    }

    let loader = HerdLoader(
      inject({
        logger: Logger(console),
        ReleasePlan: ReleasePlan,
        exec: exec,
        featureDeploymentConfig,
      })
    )

    if (!environment) {
      printUsage()
      process.exit(0)
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
              terminateProcess(255)
            })
        } else {
          plan
            .executePlan({ dryRun: dryRun, dryRunOutputDir: outputDirectory, forcePush: forcePush, waitForRollout: waitForRollout })
            .then(function() {
              logger.info("Plan execution complete. Exiting shepherd.")
              setTimeout(() => {
                terminateProcess(0)
              }, 1000)
            })
            .catch(function(err) {
              logger.error("Plan execution error", err)
              terminateProcess(255)
            })
        }
      })
      .catch(function(loadError) {
        logger.error("Plan load error.", loadError)
        stateStoreBackend.disconnect()
        process.exit(255)
      })
  })
  .catch(function(err) {
    console.error("Connection/migration error", err)
    process.exit(255)
  })
