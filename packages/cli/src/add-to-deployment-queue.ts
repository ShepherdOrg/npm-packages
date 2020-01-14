#!/usr/bin/env node

import * as fs from 'fs'

function main(){
  const deploymentQueueFile = process.argv[2]
  const deployJsonFilePath = process.argv[3]
  const shepherdJsonFile = process.argv[4]


  function fileMustExist(path: string, message1: any) {
    if (!fs.existsSync(path)) {
      console.log(`${path} not found. ${message1}`)

    }
  }

  fileMustExist(deploymentQueueFile, "Deployment queue file must exist.")

  fileMustExist(deployJsonFilePath, "Deployment information file must exist.")
  fileMustExist(shepherdJsonFile, "Shepherd metadata file must exist.")

  let shepherdJson: any
  let deployJson: any
  try {
    shepherdJson = JSON.parse(fs.readFileSync(shepherdJsonFile, "utf-8"))
  } catch(e){
    console.error('Error reading ', shepherdJsonFile, e)
  }
  try{
    deployJson = JSON.parse(fs.readFileSync(deployJsonFilePath, "utf-8"))

  }catch(err){
    console.error('Error reading ', deployJsonFilePath, err)

  }

  deployJson.dockerImageGithash = shepherdJson.dockerImageGithash
  deployJson.semanticVersion = shepherdJson.semanticVersion
  deployJson.herdDescription = shepherdJson.displayName

  fs.appendFileSync(deploymentQueueFile, JSON.stringify(deployJson) + '\n')
}


main()


