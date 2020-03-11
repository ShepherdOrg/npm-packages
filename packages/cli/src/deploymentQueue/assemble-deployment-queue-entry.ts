import * as fs from "fs"

export function assembleDeploymentQueueEntry(shepherdJsonFile: string, deployJsonFilePath: string, branchName: string, ttlHours: string | number) {
  let shepherdJson: any
  let deployJson: any
  try {
    shepherdJson = JSON.parse(fs.readFileSync(shepherdJsonFile, "utf-8"))
  } catch (e) {
    console.error("Error reading ", shepherdJsonFile, e)
  }
  try {
    deployJson = JSON.parse(fs.readFileSync(deployJsonFilePath, "utf-8"))

  } catch (err) {
    console.error("Error reading ", deployJsonFilePath, err)
  }

  deployJson.dockerImageUrl = shepherdJson.dockerImageUrl

  deployJson.semanticVersion = shepherdJson.semanticVersion
  deployJson.herdDescription = shepherdJson.displayName

  if (branchName && branchName !== 'master') {
    deployJson.branchName = branchName
    deployJson.ttlHours = deployJson.ttlHours || ttlHours
    deployJson.environments =  deployJson.branchDeployToEnvironments || []
  }
  delete deployJson.branchDeployToEnvironments

  return deployJson
}
