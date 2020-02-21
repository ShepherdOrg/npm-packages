import {
  dockerImageMetadata,
  TDockerImageReference,
  TDockerInspectMetadata,
} from "./local-image-metadata"
import { TDockerImageLabels } from "./registry-metadata-client"

import * as _ from "lodash"
import { ILog } from "./index"
import { TDockerRegistryClientMap } from "./docker-registry-clients-config"

const exec = require("@shepherdorg/exec")

export interface TImageLabelsLoaderDependencies {
  dockerRegistries: TDockerRegistryClientMap
  logger: ILog
}

export interface ILoadDockerImageLabels {
  getImageLabels(imageDef: TDockerImageReference):any
}

export function imageLabelsLoader(injected:TImageLabelsLoaderDependencies) : ILoadDockerImageLabels {
  const logger = injected.logger || console

  const localImageLoader = dockerImageMetadata(
    {
      logger: logger,
      exec: exec,
    }
  )

  const dockerRegistries = injected.dockerRegistries

  function findMatchingRegistry(imageDef: TDockerImageReference) {
    return _.find(dockerRegistries, (_registry, registryHost) => {
      return Boolean(imageDef.image && imageDef.image.startsWith(registryHost))
    })
  }

  const getImageLabels = function(
    imageDef: TDockerImageReference
  ): Promise<TDockerInspectMetadata> {
    const matchingRegistry = findMatchingRegistry(imageDef)

    if (matchingRegistry) {
      return matchingRegistry
        .getImageManifestLabels(imageDef.image, imageDef.imagetag)
        .then((dockerImageLabels: TDockerImageLabels) => {
          logger.debug(
            `${imageDef.image}:${imageDef.imagetag} metadata loaded using registry API`
          )
          return {
            dockerLabels: dockerImageLabels,
            imageDeclaration: imageDef,
          }
        })
    } else {
      return localImageLoader
        .inspectImageLabels(imageDef)
        .then(dockerImageLabels => {
          logger.debug(
            `${imageDef.image}:${imageDef.imagetag} metadata loaded using docker inspect`
          )
          return {
            dockerLabels: dockerImageLabels,
            imageDeclaration: imageDef,
          }
        })
    }
  }

  return {
    getImageLabels,
  }
}
