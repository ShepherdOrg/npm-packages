import * as _ from "lodash"
import { TDeployerMetadata, TK8sMetadata } from "@shepherdorg/metadata"
import { TImageInformation, TShepherdMetadata } from "../deployment-types"
import { TDockerImageLabels } from "@shepherdorg/docker-image-metadata-loader"

const extractImageMetadata = require("@shepherdorg/metadata/dist/dockerLabelParser")
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

export async function extractShepherdMetadata (dockerImageMetadata:TImageInformation): Promise<TImageInformation> {
  let imageLabels = rewriteDockerLabels(
    dockerImageMetadata.dockerLabels,
    "is.icelandairlabs",
    "shepherd"
  )
  const shepherdMetadata: TDeployerMetadata | TK8sMetadata = await extractImageMetadata(imageLabels)

  // @ts-ignore
  if(dockerImageMetadata.imageDefinition){
    console.error('Something fishy going on here, imageDefinition set on dockerImageMetadata')
  }
  return {
    dockerLabels: dockerImageMetadata.dockerLabels,
    // @ts-ignore
    imageDeclaration: dockerImageMetadata.imageDeclaration || dockerImageMetadata.imageDefinition,
    shepherdMetadata: shepherdMetadata
  }
}
