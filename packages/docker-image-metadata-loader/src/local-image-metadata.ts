import { TDockerImageLabels } from "./registry-metadata-client"
import { ILog } from "."
import { FExec, TExecError } from "@shepherdorg/ts-exec"

export interface TDockerInspectMetadata {
  dockerLabels: TDockerImageLabels
  imageDeclaration: TDockerImageReference
}

export type TDockerImageReference = {
  image: string
  imagetag: string
}

function extractImageLabels(dockerImageMetadata: any, imageDef: TDockerImageReference, logger, dockerImageName) {
  let ContainerConfig = dockerImageMetadata[0].ContainerConfig
  let Labels = ContainerConfig.Labels

  let imageMetadata = {
    imageDeclaration: imageDef,
    dockerLabels: Labels,
  }
  if (Labels) {
    logger.debug(dockerImageName + " has image metadata with the following Labels", Object.keys(Labels).join(", "))
  }
  return imageMetadata
}

export type TLocalImageMetadataOptions = {
  exec: FExec
  logger: ILog
}

export function dockerImageMetadata(inj: TLocalImageMetadataOptions) {
  const logger = inj.logger || console

  const exec: FExec = inj.exec

  async function inspectImage(
    imageDef: TDockerImageReference,
    retryCount: number = 0
  ): Promise<TDockerInspectMetadata> {
    let dockerImage = imageDef.image + ":" + imageDef.imagetag
    logger.debug("Extracting labels from image " + dockerImage)

    return exec("docker", ["inspect", dockerImage], { env: process.env })
      .then(function(execResult) {
        let dockerImageMetadata: any
        try {
          dockerImageMetadata = JSON.parse(execResult.stdout)
        } catch (e) {
          throw new Error(`Error parsing docker metadata ${execResult.stdout}`)
        }

        try {
          let imageMetadata = extractImageLabels(dockerImageMetadata, imageDef, logger, dockerImage)
          return imageMetadata
        } catch (e) {
          throw new Error(
            "Error processing metadata retrieved from docker inspect of image " +
              dockerImage +
              ":\n" +
              e +
              "\nMetadata document:\n" +
              execResult
          )
        }
      })
      .catch((dockerExecErr: TExecError) => {
        logger.debug("docker inspect error:", dockerExecErr.stderr)
        if (dockerExecErr.stderr.indexOf("No such") >= 0) {
          if (retryCount > 1) {
            throw new Error("ERROR:" + dockerImage + ": " + dockerExecErr)
          }
          logger.debug("Going to pull ", JSON.stringify(imageDef))

          return exec("docker", ["pull", dockerImage], { env: process.env })
            .then((/*execResult*/) => {
              logger.info(dockerImage + " pulled, retrying inspect to load metadata")
              return inspectImage(imageDef, 2).then(function(result) {
                return result
              })
            })
            .catch((dockerPullErr: TExecError) => {
              throw new Error(`Unable to get metadata for docker image ${dockerImage}.\n ${dockerPullErr.stderr}`)
            })
        } else {
          throw new Error("Error inspecting " + dockerImage + ":\n" + dockerExecErr)
        }
      })
  }

  function inspectImageLabels(imageDef): Promise<TDockerImageLabels> {
    return inspectImage(imageDef).then(imageMetadata => {
      return imageMetadata.dockerLabels as TDockerImageLabels
    })
  }

  return {
    inspectImage,
    inspectImageLabels,
  }
}
