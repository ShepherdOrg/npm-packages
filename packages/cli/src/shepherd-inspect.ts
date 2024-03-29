import { extractShepherdMetadata } from "@shepherdorg/metadata/dist/dockerLabelParser"

const labelsLoader = require("@shepherdorg/docker-image-metadata-loader")

function shepherdInspect(dockerImageWithTag: string) {
  const logger = {
    debug: () => {},
    info: console.info,
    error: console.error,
  }
  const dockerRegistries = labelsLoader.getDockerRegistryClientsFromConfig()
  const loader = labelsLoader.imageLabelsLoader({ dockerRegistries: dockerRegistries, logger: logger })

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
    if (!output.dockerLabels) {
      throw new Error(
        "Shepherd inspect returned insufficent data for " + dockerImageWithTag + ". No dockerLabels present in output."
      )
    }
    return extractShepherdMetadata(output.dockerLabels)
  })
}
