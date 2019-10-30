import { extractShepherdMetadata } from "@shepherdorg/metadata/dist/dockerLabelParser"
import { inject } from "@shepherdorg/nano-inject"

const labelsLoader = require("@shepherdorg/docker-image-metadata-loader")

function shepherdInspect(dockerImageWithTag: string) {
  const logger = {
    debug: () => {},
    info: console.info,
    error: console.error,
  }
  const dockerRegistries = labelsLoader.getDockerRegistryClientsFromConfig()
  const loader = labelsLoader.imageLabelsLoader(
    inject({ dockerRegistries: dockerRegistries, logger: logger })
  )

  return loader
    .getImageLabels({
      image: dockerImageWithTag.split(":")[0],
      imagetag: dockerImageWithTag.split(":")[1],
    })
    .then(imageLabels => {
      return imageLabels
    })
}

export function inspectAndExtractShepherdMetadata(dockerImageWithTag: string) {
  return shepherdInspect(dockerImageWithTag).then(output => {
    return extractShepherdMetadata(output.dockerLabels)
  })
}
