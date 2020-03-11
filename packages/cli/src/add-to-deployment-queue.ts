#!/usr/bin/env node

import * as fs from "fs"
import { assembleDeploymentQueueEntry } from "./deploymentQueue/assemble-deployment-queue-entry"

function main(){
  // Required parameters
  const deploymentQueueFile = process.argv[2]
  const deployJsonFilePath = process.argv[3]
  const shepherdJsonFile = process.argv[4]

  // Optional parameters
  const branchName = process.argv[5]
  const ttlHours = process.argv[6] || process.env.BRANCH_TTL_HOURS || 48

  function fileMustExist(path: string, message1: any) {
    if (!fs.existsSync(path)) {
      console.info(`${path} not found. ${message1}`)

    }
  }

  fileMustExist(deploymentQueueFile, "Deployment queue file must exist.")

  fileMustExist(deployJsonFilePath, "Deployment information file must exist.")
  fileMustExist(shepherdJsonFile, "Shepherd metadata file must exist.")

  let deployJson = assembleDeploymentQueueEntry(shepherdJsonFile, deployJsonFilePath, branchName, ttlHours)

  if(deployJson.environments.length){
    fs.appendFileSync(deploymentQueueFile, JSON.stringify(deployJson) + '\n')
  } else {
    console.warn(`No deployment environments targeted for ${deployJson.deploymentKey}, not queuing for deployment. (probably missing branchDeployToEnvironments list to target environments on a branch).`)
  }
}


main()


