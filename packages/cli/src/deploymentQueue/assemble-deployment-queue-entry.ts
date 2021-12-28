import * as fs from "fs"

export function assembleDeploymentQueueEntry(
  shepherdJson: any,
  deployJsonFilePath: string,
  branchName: string,
  ttlHours: string | number,
  branchDeploy: boolean
) {
  let deployJson: any
  try {
    deployJson = JSON.parse(fs.readFileSync(deployJsonFilePath, "utf-8"))
  } catch (err) {
    console.error("Error reading ", deployJsonFilePath, err)
  }

  deployJson.dockerImageUrl = shepherdJson.dockerImageUrl

  deployJson.semanticVersion = shepherdJson.semanticVersion
  deployJson.herdDescription = shepherdJson.displayName

  if (branchDeploy) {
    deployJson.branchName = branchName
    deployJson.ttlHours = deployJson.ttlHours || ttlHours
    deployJson.environments = deployJson.branchDeployToEnvironments || []
  }
  delete deployJson.branchDeployToEnvironments

  return deployJson
}
