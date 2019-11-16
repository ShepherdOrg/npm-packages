import * as _ from "lodash"
import { TDeployerMetadata, TK8sMetadata  } from "@shepherdorg/metadata"

const extractShepherdMetadata = require("@shepherdorg/metadata/dist/dockerLabelParser")
  .extractShepherdMetadata

function rewriteDockerLabels(
  dockerLabelsObject,
  obsoleteQualifier,
  newQualifier
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

export async function getShepherdMetadata (dockerImageMetadata:any) {
  let imageLabels = rewriteDockerLabels(
    dockerImageMetadata.dockerLabels,
    "is.icelandairlabs",
    "shepherd"
  )
  const shepherdMetadata: TDeployerMetadata | TK8sMetadata = await extractShepherdMetadata(imageLabels)

  return {
    imageDefinition: dockerImageMetadata.imageDefinition,
    // dockerLabels: imageMetadata.dockerLabels, // If we need dockerlabels in the future, this is the place to put it in again.
    shepherdMetadata: shepherdMetadata,
  }
}
