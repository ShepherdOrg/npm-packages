#!/usr/bin/env node
"use strict"
import * as path from "path"

import * as fs from "fs"
import { IStorageBackend } from "@shepherdorg/state-store"
import { TFileSystemPath } from "./helpers/basic-types"
import { flatMapPolyfill } from "./herd-loading/folder-loader/flatmap-polyfill"
import { createLogger, LOG_CONTEXT_PREFIX_PADDING } from "@shepherdorg/logger"
import { createLoaderContext } from "./herd-loading/createLoaderContext"
import { renderPlanExecutionError } from "./deployment-plan/renderPlanExecutionError"
import { IDeploymentOrchestration } from "./deployment-orchestration/deployment-orchestration"
import { InMemoryStore } from "@shepherdorg/state-store/dist/in-memory-backend"
import { IDeploymentPlanExecutionResult, renderPlanFailureSummary } from "./deployment-plan/deployment-plan"
import * as chalk from "chalk"
import { padLeft } from "@shepherdorg/logger"
import { initRegistryLogin } from "@shepherdorg/docker-image-metadata-loader"
import { IPushToShepherdUI } from "./deployment-types"
import { exec } from "@shepherdorg/ts-exec"

let CreatePushApi = require("@shepherdorg/ui-push").CreatePushApi

/*
This is the main entry point for shepherd deployer agent
 */

function printUsage() {
  console.info(`Usage: shepherd-deploy /path/to/herd.yaml | /path/to/shepherd.json ENVIRONMENT <options>
Supported options:

    --export             Export deployment documents to outputDir
    --dryrun             Run without actually deploying. Exports documents to outputDir. Ignores changes to versions 
                         and configuration, pretends that everything needs to be deployed.
                         Loads environment variables from dryrun.env, where you can place variables that would otherwise 
                         come from a secret store.
    --force-push         Force push of deployment data to consumers during --dryrun (this is not git push)
    --wait-for-rollout   Wait for any kubernetes deployment rollouts to complete before determining successful deployment. 
                         Shepherd does not wait for rollouts by default.
    --push-to-ui         Push data to shepherd UI. See SHEPHERD_UI_API_ENDPOINT below.
    
    --registry-login 
                         Login to docker registry to enable API usage and avoid docker pulls where possible. Only necessary
                         where docker is using a credentials manager like on OsX. Will prompt for username and password. 
    
Dryrun will write to directory specified by 
    --outputDir <directory>
 
Options through environment variables:

Upstream build job input. The first three must be provided together or all skipped.    
    UPSTREAM_HERD_KEY           - Herd key from upstream trigger. Equivalent to key in images section in herd.yaml
    UPSTREAM_IMAGE_URL          - Docker image url from upstream build.  
    UPSTREAM_HERD_DESCRIPTION   - Short description that would otherwise be in the herd.yaml file.
    UPSTREAM_WAIT_FOR_ROLLOUT   - Upstream build wants rollout to complete before getting control back. Useful when 
                                  post-processing in upstream build depends on rollout being complete, such as running e2e tests.
                                  Kubernetes deployment specific. "true" triggers rollout wait, any other value does not.
    UPSTREAM_ROLLOUT_TIMEOUT    - Timeout to wait for rollout to complete, in seconds. Option for UPSTREAM_WAIT_FOR_ROLLOUT.
                                  Zero means default timeout will be used.

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
    The following environment variables are used to enable parameterising branch deployments.
    BRANCH_NAME              - set to FEATURE_NAME from upstream branch deployment
    BRANCH_NAME_PREFIX       - set to \${FEATURE_NAME}-
    BRANCH_NAME_POSTFIX      - set to -\${FEATURE_NAME}   
    
    Note that branch deployments are NOT added to configuration management. That is, changes to configuration values will
    not trigger redeployment or reconfiguration of active branch deployments.

Examples
    Deploy all deployments in a given herd.yaml    
        shepherd-deploy ./deployments/dev/herd.yaml DEV --dryrun
    
    Deploy a single deployment using the shepherd declaration file. Useful for development and when starting with shepherd.
        shepherd-deploy ./shepherd.json DEV --dryrun
`)
}

function hasArg(param: string) {
  return process.argv.includes(param)
}

if (hasArg("--help")) {
  printUsage()
  process.exit(0)
}

function printVersions() {
  console.info(`deployer v${require("../package.json").version}`)
  console.info(`metadata v${require("@shepherdorg/metadata/package").version}`)
}

function loginToRegistryWithPrompt() {
  const prompt = require("prompt")

  prompt.message = "Docker registry"
  const properties = [
    {
      name: "host",
    },
    {
      name: "username",
    },
    {
      name: "password",
      hidden: true,
    },
  ]

  prompt.start()

  prompt.get(properties, function(err: Error, result: { username: string; password: string; host: string }) {
    if (err) {
      return onErr(err)
    }

    initRegistryLogin({ homeDir: require("os").homedir() })
      .registryLogin(result.host, result.username, result.password)
      .then((loginSuccess: boolean) => {
        loginSuccess
          ? console.info(chalk.green(result.username) + " logged in to " + chalk.green(result.host))
          : console.error(chalk.red("Login failed"))
      })
  })

  function onErr(err: Error) {
    console.log(err)
    return 1
  }
}

function main() {
  if (process.argv.indexOf("--version") > 0) {
    printVersions()
    process.exit(0)
  }

  if (hasArg("--registry-login")) {
    return loginToRegistryWithPrompt()
  }

  flatMapPolyfill()

  let defaultLogContext = { color: chalk.gray, prefix: padLeft(LOG_CONTEXT_PREFIX_PADDING, ">") }

  const logger = createLogger(console, { maxWidth: process.stdout.columns, defaultContext: defaultLogContext })

  console.debug = function() {
    // Array.prototype.unshift.call(arguments, 'SHEPDEBUG ');
    // console.log.apply(console, arguments);
  }

  let dryRun = process.argv.indexOf("--dryrun") > 0
  let pushToUi = process.argv.indexOf("--push-to-ui") > 0 || Boolean(process.env.SHEPHERD_UI_API_ENDPOINT)

  let waitForRollout =
    process.env.UPSTREAM_WAIT_FOR_ROLLOUT === "true" || process.argv.indexOf("--wait-for-rollout") > 0

  let rolloutTimeout = (process.env.UPSTREAM_ROLLOUT_TIMEOUT && parseInt(process.env.UPSTREAM_ROLLOUT_TIMEOUT)) || 0
  const exportDocuments = process.argv.indexOf("--export") > 0

  let outputDirectory: TFileSystemPath | undefined

  if (hasArg("--outputDir")) {
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

  let uiDataPusher: IPushToShepherdUI

  if (dryRun) {
    logger.info(`NOTE: Dryrun does not take deployment state into account and assumes everything needs to be deployed.`)
    stateStoreBackend = InMemoryStore()
  } else {
    if (process.env.SHEPHERD_PG_HOST) {
      logger.info(`Using postgres state store on ${process.env.SHEPHERD_PG_HOST}`)
      const pgConfig = require("@shepherdorg/postgres-backend").PgConfig()
      const PostgresStore = require("@shepherdorg/postgres-backend").PostgresStore
      stateStoreBackend = PostgresStore(pgConfig)
    } else {
      const FileStore = require("@shepherdorg/filestore-backend").FileStore
      let homedir = require("os").homedir()
      let shepherdStoreDir =
        process.env.SHEPHERD_FILESTORE_DIR || path.join(homedir, ".shepherdstore", process.env.ENV || "default")
      logger.info(`WARNING: Falling back to file based state store directory in ${shepherdStoreDir}`)
      stateStoreBackend = FileStore({ directory: shepherdStoreDir })
    }

    if (Boolean(process.env.SHEPHERD_UI_API_ENDPOINT)) {
      logger.info(`Shepherd UI API endpoint configured ${process.env.SHEPHERD_UI_API_ENDPOINT}`)
      uiDataPusher = CreatePushApi(process.env.SHEPHERD_UI_API_ENDPOINT, console)
    }
  }

  const ReleaseStateStore = require("@shepherdorg/state-store").ReleaseStateStore

  const {
    createUpstreamTriggerDeploymentConfig,
  } = require("./triggered-deployment/create-upstream-trigger-deployment-config")

  const upgradeOrAddDeploymentInFile = require("./herd-file/herd-edit").upgradeOrAddDeploymentInFile

  function terminateProcess(exitCode: number) {
    console.log(`DEBUG Terminating process with code`, exitCode)
    stateStoreBackend.disconnect()
    process.exit(exitCode)
  }

  let herdFilePath = process.argv[2]
  let environment = process.argv[3]

  if (!environment) {
    logger.error("Environment is a mandatory parameter")
    printUsage()
    process.exit(255)
  }

  stateStoreBackend
    .connect()
    .then(function() {
      let releaseStateStore = ReleaseStateStore({
        storageBackend: stateStoreBackend,
      })
      let upstreamDeploymentConfig = createUpstreamTriggerDeploymentConfig(logger)
      upstreamDeploymentConfig.loadFromEnvironment(herdFilePath, process.env)

      if (upstreamDeploymentConfig.herdFileEditNeeded()) {
        upgradeOrAddDeploymentInFile(upstreamDeploymentConfig, logger)
      }

      let loaderContext = createLoaderContext({
        stateStore: releaseStateStore,
        logger: logger,
        featureDeploymentConfig: upstreamDeploymentConfig,
        uiPusher: uiDataPusher,
        environment: environment,
        exec: exec,
      })

      logger.info("Calculating deployment of herd from file " + herdFilePath + " for environment " + environment)

      loaderContext.loader
        .loadHerd(herdFilePath)
        .then(function(plan: IDeploymentOrchestration) {
          plan.printPlan(logger)
          if (exportDocuments) {
            logger.info("Testrun mode set - exporting all deployment documents to " + outputDirectory)
            logger.info("Testrun mode set - no deployments will be performed")
            plan
              .exportDeploymentActions(outputDirectory as TFileSystemPath)
              .then(function() {
                terminateProcess(0)
              })
              .catch(function(writeError: Error) {
                logger.error("Error exporting deployment document! ", writeError)
                terminateProcess(255)
              })
          } else {
            // TODOLATER Rollback on kube config

            let dryRunString = `${dryRun ? " dryrun" : ""}`

            logger.info(`Executing deployment plan${dryRunString}... `)
            plan
              .executePlans({
                dryRun: dryRun,
                dryRunOutputDir: outputDirectory,
                pushToUi: pushToUi,
                waitForRollout: waitForRollout,
                rolloutWaitSeconds: rolloutTimeout,
                logContext: defaultLogContext,
              })
              .then(function(planResults: IDeploymentPlanExecutionResult[]) {
                // Exceptions from plan execution are logged immediately. Here we render only a summary of deployment results.
                const failedPlans = planResults.filter(planExecutionResult => {
                  return planExecutionResult.actionExecutionError !== undefined
                })
                if (failedPlans.length > 0) {
                  renderPlanFailureSummary(logger, failedPlans)
                  return terminateProcess(failedPlans.length)
                }
                logger.info(`...plan${dryRunString} execution complete. Exiting shepherd.`)
                setTimeout(() => {
                  terminateProcess(0)
                }, 1000)
              })
              .catch(function(err: Error) {
                renderPlanExecutionError(logger, err, defaultLogContext)
                terminateProcess(255)
              })
          }
        })
        .catch(function(loadError) {
          logger.debug(`Plan load error, with stack`, loadError)
          logger.error(`Plan load error. ${loadError.message}`)
          if (loadError.context) {
            logger.error(` ${JSON.stringify(loadError.context)}`)
          }
          stateStoreBackend.disconnect()
          process.exit(255)
        })
    })
    .catch(function(err: Error) {
      console.error("Connection/migration error", err)
      process.exit(255)
    })
}

main()
