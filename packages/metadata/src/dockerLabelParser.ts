import {
  TCompressedMetadata,
  TDeployerRole,
  TDeploymentType,
  TDockerImageInspection,
  TDeployerMetadata,
  TK8sMetadata,
  TImageMetadata,
} from "./index"

import uncompressBase64Tar from "./base64tar/untar-string"

export function extractImageLabels(
  dockerImageMetadata: TDockerImageInspection
) {
  let ContainerConfig = dockerImageMetadata[0].ContainerConfig
  return ContainerConfig.Labels
}

function decodeShepherdMetadataLabel(imageLabel: TCompressedMetadata) {
  return uncompressBase64Tar(imageLabel).then(tarFiles => {
    try {
      const shepherdMeta = JSON.parse(tarFiles["shepherd.json"].content)
      if (shepherdMeta.lastCommits) {
        shepherdMeta.lastCommits = decodeBase64String(shepherdMeta.lastCommits)
      }

      if (shepherdMeta.kubeConfigB64) {
        return uncompressBase64Tar(shepherdMeta.kubeConfigB64).then(
          kubeDeploymentFiles => {
            shepherdMeta.kubeDeploymentFiles = kubeDeploymentFiles
            return shepherdMeta
          }
        )
      } else {
        return shepherdMeta as TImageMetadata
      }
    } catch (err) {
      throw new Error(`Error parsing JSON ${tarFiles}`)
    }
  })
}

function decodeBase64String(base64EncodedString: string): string {
  // @ts-ignore
  return new Buffer.from(base64EncodedString, "base64").toString()
}

function determineDeploymentType(imageLabels: any): TDeploymentType {
  if (
    Boolean(imageLabels["shepherd.deployer"]) ||
    Boolean(imageLabels["shepherd.deployer.command"]) ||
    imageLabels["shepherd.infrastructure"] === "true"
  ) {
    return TDeploymentType.Deployer
  } else if (Boolean(imageLabels["shepherd.kube.config.tar.base64"])) {
    return TDeploymentType.Kubernetes
  } else {
    throw new Error(
      "Unable to determine deployment type from image labels: " +
        JSON.stringify(imageLabels)
    )
  }
}

export async function extractShepherdMetadata(
  imageLabels: any
): Promise<TDeployerMetadata | TK8sMetadata> {
  if (imageLabels["shepherd.metadata"]) {
    return await decodeShepherdMetadataLabel(imageLabels["shepherd.metadata"])
  } else if (
    imageLabels &&
    Object.getOwnPropertyNames(imageLabels).find(propName =>
      propName.startsWith("shepherd.")
    )
  ) {
    let deploymentType = determineDeploymentType(imageLabels)

    let imageInfo = {
      displayName: imageLabels["shepherd.name"],
      buildDate: imageLabels["shepherd.builddate"],
      migrationImage: imageLabels["shepherd.dbmigration"],
      gitBranch: imageLabels["shepherd.git.branch"],
      gitHash: imageLabels["shepherd.git.hash"],
      gitUrl: imageLabels["shepherd.git.url"],
      kubeConfigB64: imageLabels["shepherd.kube.config.tar.base64"],
      kubeDeploymentFiles:
        imageLabels["shepherd.kube.config.tar.base64"] &&
        (await uncompressBase64Tar(
          imageLabels["shepherd.kube.config.tar.base64"]
        )),
      lastCommits:
        imageLabels["shepherd.lastcommits"] &&
        decodeBase64String(imageLabels["shepherd.lastcommits"]),
      semanticVersion: imageLabels["shepherd.version"],
      deploymentType: deploymentType,
      deployCommand: imageLabels["shepherd.deployer.command"],
      rollbackCommand: imageLabels["shepherd.rollback.command"],
      environmentVariablesExpansionString:
        imageLabels["shepherd.environment.variables"],
      deployerRole: TDeployerRole.Install, //
    }
    return Promise.resolve(imageInfo)
  } else {
    throw new Error(
      "No shepherd labels present in docker image Labels " +
        JSON.stringify(imageLabels)
    )
  }
}

export async function extractMetadataFromDockerInspectJson(
  jsonFileName = "./testdata/inspected-dockers/public-repo-with-deployment-dir.json"
) {
  const dockerImageInspection = require(jsonFileName)
  const imageLabels = extractImageLabels(dockerImageInspection)
  return await extractShepherdMetadata(imageLabels)
}
