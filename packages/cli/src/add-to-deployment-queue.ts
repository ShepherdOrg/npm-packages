#!/usr/bin/env node

import * as fs from "fs"
import { assembleDeploymentQueueEntry } from "./deploymentQueue/assemble-deployment-queue-entry"
import { inspectAndExtractShepherdMetadata } from "./shepherd-inspect"
import * as process from "process"

async function main() {
  // Required parameters
  const deploymentQueueFile = process.argv[2]
  const deployJsonFilePath = process.argv[3]

  const shepherdDockerImage = process.argv[4]

  // Optional parameters
  const branchName = process.argv[5]
  const ttlHours = process.argv[6] || process.env.BRANCH_TTL_HOURS || 48
  const trunkBranchName = process.argv[7] || process.env.TRUNK_BRANCH_NAME || "master"

  function fileMustExist(path: string, message1: any) {
    if (!fs.existsSync(path)) {
      console.info(`${path} not found. ${message1}`)
    }
  }

  fileMustExist(deploymentQueueFile, "Deployment queue file must exist.")

  fileMustExist(deployJsonFilePath, "Deployment information file must exist.")

  const shepherdJson = await inspectAndExtractShepherdMetadata(shepherdDockerImage)

  let isBranchDeploy = (branchName && branchName !== trunkBranchName) || false

  let deployJson = assembleDeploymentQueueEntry(shepherdJson, deployJsonFilePath, branchName, ttlHours, isBranchDeploy)

  if (deployJson.environments.length) {
    fs.appendFileSync(deploymentQueueFile, JSON.stringify(deployJson) + "\n")
  } else {
    console.info(
      `No deployment environments targeted for ${deployJson.deploymentKey}, not queuing for deployment. (probably missing branchDeployToEnvironments list to target environments on a branch).`
    )
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error("Error adding to deployment queue. " + process.argv.join(" "))
    console.error(err)
    process.exit(255)
  })
