import * as _ from "lodash"
import { TDeployerMetadata, TK8sMetadata } from "@shepherdorg/metadata"
import { TImageInformation, TShepherdMetadata } from "../deployment-types"
import { TDockerImageLabels } from "@shepherdorg/docker-image-metadata-loader"

const extractShepherdMetadata = require("@shepherdorg/metadata/dist/dockerLabelParser")
  .extractShepherdMetadata

function rewriteDockerLabels(
  dockerLabelsObject: TDockerImageLabels,
  obsoleteQualifier: string,
  newQualifier: string
) {
  const result = Object.assign({}, dockerLabelsObject)
  _(result)
    .keys()
    .each(dockerLabelKey => {
      if (dockerLabelKey.startsWith(obsoleteQualifier)) {
        const newKey = dockerLabelKey.replace(obsoleteQualifier, newQualifier)
        result[newKey] = result[dockerLabelKey]
        delete result[dockerLabelKey]
      }
    })
  return result
}

export async function getShepherdMetadata (dockerImageMetadata:TImageInformation): Promise<TShepherdMetadata> {
  let imageLabels = rewriteDockerLabels(
    dockerImageMetadata.dockerLabels,
    "is.icelandairlabs",
    "shepherd"
  )
  const shepherdMetadata: TDeployerMetadata | TK8sMetadata = await extractShepherdMetadata(imageLabels)

  return {
    imageDefinition: dockerImageMetadata.imageDefinition,
    shepherdMetadata: shepherdMetadata,
  }
}
