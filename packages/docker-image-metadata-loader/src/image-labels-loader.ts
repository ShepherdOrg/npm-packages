import {
  dockerImageMetadata,
  TDockerImageReference,
  TDockerInspectMetadata,
} from "./local-image-metadata"
import { TDockerImageLabels } from "./registry-metadata-client"
import { inject } from "@shepherdorg/nano-inject"

import * as _ from "lodash"

const exec = require("@shepherdorg/exec")

export function imageLabelsLoader(injected) {
  const logger = injected("logger")

  const localImageLoader = dockerImageMetadata(
    inject({
      logger: logger,
      exec: exec,
    })
  )

  const dockerRegistries = injected("dockerRegistries")

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
            imageDefinition: imageDef,
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
            imageDefinition: imageDef,
          }
        })
    }
  }

  return {
    getImageLabels,
  }
}
