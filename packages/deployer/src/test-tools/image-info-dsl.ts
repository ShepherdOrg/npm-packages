import { TDeployerMetadata } from "@shepherdorg/metadata"
import { TDockerImageHerdDeclaration } from "../deployment-types"

export function imageInfoDSL(shepherdMetadata: TDeployerMetadata) {
  let imageDeclaration: TDockerImageHerdDeclaration = {
    image: "", imagetag: "", key: "",
  }

  let imageInfoInstance = { dockerLabels: {}, env: "", imageDeclaration: imageDeclaration, shepherdMetadata: shepherdMetadata }

  return {
    instance(){
      return imageInfoInstance
    }
  }
}
