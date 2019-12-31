#!/usr/bin/env node
"use strict"
import * as path from "path"

import * as fs from "fs"
import { DeploymentOrchestrationModule } from "./deployment-orchestration/deployment-orchestration"

import { HerdLoader } from "./herd-loading/herd-loader"
import { getDockerRegistryClientsFromConfig, imageLabelsLoader } from "@shepherdorg/docker-image-metadata-loader"
import { IStorageBackend } from "@shepherdorg/state-store"
import { TFileSystemPath } from "./helpers/basic-types"

let CreatePushApi = require("@shepherdorg/ui-push").CreatePushApi

/*
This is the main entry point for shepherd deployer agent
 */

function printUsage() {
  console.info(`Usage: shepherd /path/to/a/herd.yaml ENVIRONMENT <options>

Supported options:

    --export             Export deployment documents to outputDir
    --dryrun             Run without actually deploying. Exports documents to outputDir. 
    --force-push         Force push of deployment data to consumers during --dryrun (this is not git push)
    --wait-for-rollout   Wait for any kubernetes deployment rollouts to complete before determining successful deployment. 
                         Shepherd does not wait for rollouts by default.
    --push-to-ui           Push data to shepherd UI. See SHEPHERD_UI_API_ENDPOINT below.
    
    
Both will write to directory specified by 
    --outputDir <directory>
 
Options through environment variables:

Upstream build job input. The first three must be provided together or all skipped.    
    UPSTREAM_HERD_KEY           - Herd key from upstream trigger. Equivalent to key in images section in herd.yaml
    UPSTREAM_IMAGE_NAME         - Docker image name from upstream. Always without tag. 
    UPSTREAM_IMAGE_TAG          - Docker image tag from upstream trigger. 
    UPSTREAM_HERD_DESCRIPTION   - Short description that would otherwise be in the herd.yaml file.
    UPSTREAM_WAIT_FOR_ROLLOUT   - Upstream build wants rollout to complete before getting control back. Designed for e2e tests.

Push data to Shepherd UI:
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

Other reserved environment variables:
    The following environment variables are used to enable parameterising branch deployments
    BRANCH_NAME              - set to FEATURE_NAME from upstream branch deployment
    BRANCH_NAME_PREFIX       - set to \${FEATURE_NAME}-
    BRANCH_NAME_POSTFIX      - set to -\${FEATURE_NAME}   

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
global._ = require("lodash")
global.Promise = require("bluebird")

let Logger = require("./logging/logger")

const logger = Logger(console)

console.debug = function() {
  // Array.prototype.unshift.call(arguments, 'SHEPDEBUG ');
  // console.log.apply(console, arguments);
}

let dryRun = process.argv.indexOf("--dryrun") > 0
let pushToUi = process.argv.indexOf("--push-to-ui") > 0 || Boolean(process.env.SHEPHERD_UI_API_ENDPOINT)

let waitForRollout = process.env.UPSTREAM_WAIT_FOR_ROLLOUT === "true" || process.argv.indexOf("--wait-for-rollout") > 0

const exportDocuments = process.argv.indexOf("--export") > 0

let outputDirectory: TFileSystemPath | undefined

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

let stateStoreBackend: IStorageBackend
let uiDataPusher: { pushDeploymentStateToUI: (deploymentState: any) => Promise<any | undefined> } // TODO: Need proper type export form uiDataPusher

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
  logger.info(`Shepherd UI API endpoint configured ${process.env.SHEPHERD_UI_API_ENDPOINT}`)
  uiDataPusher = CreatePushApi(process.env.SHEPHERD_UI_API_ENDPOINT, console)
}

const ReleaseStateStore = require("@shepherdorg/state-store").ReleaseStateStore
const exec = require("@shepherdorg/exec")
const {
  CreateUpstreamTriggerDeploymentConfig,
} = require("./triggered-deployment/create-upstream-trigger-deployment-config")

const upgradeOrAddDeploymentInFile = require("./herd-file/herd-edit").upgradeOrAddDeploymentInFile

function terminateProcess(exitCode: number) {
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

    const ReleasePlan = DeploymentOrchestrationModule({
      cmd: exec,
      logger: Logger(console),
      stateStore: releaseStateStore,
      uiDataPusher: uiDataPusher,
    })

    if (featureDeploymentConfig.herdFileEditNeeded()) {
      upgradeOrAddDeploymentInFile(featureDeploymentConfig, logger)
    }

    let loader = HerdLoader({
      logger: Logger(console),
      ReleasePlan: ReleasePlan,
      exec: exec,
      featureDeploymentConfig,
      labelsLoader: {
        imageLabelsLoader: imageLabelsLoader,
        getDockerRegistryClientsFromConfig: getDockerRegistryClientsFromConfig,
      },
    })

    if (!environment) {
      printUsage()
      process.exit(0)
    }

    logger.info("Shepherding herd from file " + herdFilePath + " for environment " + environment)
    loader
      .loadHerd(herdFilePath, environment)
      .then(function(plan: any) {
        plan.printPlan(logger)
        if (exportDocuments) {
          logger.info("Testrun mode set - exporting all deployment documents to " + outputDirectory)
          logger.info("Testrun mode set - no deployments will be performed")
          plan
            .exportDeploymentDocuments(outputDirectory as TFileSystemPath)
            .then(function() {
              terminateProcess(0)
            })
            .catch(function(writeError: Error) {
              logger.error("Error exporting deployment document! ", writeError)
              terminateProcess(255)
            })
        } else {
          plan
            .executePlan({
              dryRun: dryRun,
              dryRunOutputDir: outputDirectory,
              pushToUi: pushToUi,
              waitForRollout: waitForRollout,
            })
            .then(function() {
              logger.info("Plan execution complete. Exiting shepherd.")
              setTimeout(() => {
                terminateProcess(0)
              }, 1000)
            })
            .catch(function(err: Error) {
              logger.error("Plan execution error", err)
              terminateProcess(255)
            })
        }
      })
      .catch(function(loadError) {
        logger.error(`Plan load error. ${loadError.message}`)
        stateStoreBackend.disconnect()
        process.exit(255)
      })
  })
  .catch(function(err: Error) {
    console.error("Connection/migration error", err)
    process.exit(255)
  })
