import {
  ILog,
  TDockerImageHerdDeclaration,
  TDockerImageHerdDeclarations,
  THerdSectionDeclaration,
  TImageInformation,
} from "../../deployment-types"
import { TDockerImageReference } from "@shepherdorg/docker-image-metadata-loader/dist/local-image-metadata"
import { extractShepherdMetadata } from "../add-shepherd-metadata"
import { IExec, TFileSystemPath } from "../../helpers/basic-types"
import { ILoadDockerImageLabels } from "@shepherdorg/docker-image-metadata-loader"
import { parseImageUrl, TDockerImageUrl, TDockerImageUrlStruct } from "../../helpers/parse-image-url"
import { IDeploymentPlan, IDeploymentPlanFactory } from "../../deployment-plan/deployment-plan-factory"
import { newProgrammerOops } from "oops-error"
import { IReleaseStateStore } from "@shepherdorg/state-store"

export function parseDockerImageUrl(dockerImageUrl: TDockerImageUrl): TDockerImageUrlStruct {
  return parseImageUrl(dockerImageUrl)
}

interface TImageDeclarationsLoaderDependencies {
  exec: IExec
  stateStore: IReleaseStateStore
  logger: ILog
  imageLabelsLoader: ILoadDockerImageLabels
  planFactory : IDeploymentPlanFactory
}

export function createImagesLoader(injected: TImageDeclarationsLoaderDependencies ) {
  let derivedDeployments: TDockerImageHerdDeclarations = {}

  function loadImageDeploymentPlans(images: TDockerImageHerdDeclarations, sectionDeclaration: THerdSectionDeclaration) {

    function addMigrationImageToDependenciesPlan(imageMetaData: TImageInformation) {
      if (imageMetaData.shepherdMetadata && imageMetaData.shepherdMetadata.migrationImage) {
        let dockerImageTag = parseDockerImageUrl(
          imageMetaData.shepherdMetadata.migrationImage,
        )
        derivedDeployments[imageMetaData.shepherdMetadata.migrationImage] = { sectionDeclaration: sectionDeclaration, ...dockerImageTag }
      }
      return imageMetaData
    }

    function loadImageMetadata(imageDef: TDockerImageReference) {
      return injected.imageLabelsLoader.getImageLabels(imageDef)
    }

    return Object.entries(images).map(function([imgName, herdSpec]: [string, TDockerImageHerdDeclaration]) {
      herdSpec.key = imgName
      injected.logger.debug("Deployment image - loading image meta data for docker image", JSON.stringify(herdSpec))

      if (!herdSpec.image && herdSpec.dockerImage) {
        Object.assign(herdSpec, parseDockerImageUrl(herdSpec.dockerImage))
      }
      let promise: Promise<IDeploymentPlan> = loadImageMetadata(herdSpec)
        .then(extractShepherdMetadata)
        .then(addMigrationImageToDependenciesPlan)
        .then(injected.planFactory.createDockerImageDeploymentPlan)
        .catch(function(e: Error | string) {
          let errorMessage: string
          if (typeof e === "string") {
            console.error("Thrown error of type STRING!")
            console.error(e)
            errorMessage = e
          } else {
            errorMessage = "When processing image " + imgName + "\n" + e.message
          }
          throw newProgrammerOops(errorMessage,{}, e)
        })
      return promise
    })
  }


  async function imagesLoader(herdSectionSpec: THerdSectionDeclaration,
                              images: TDockerImageHerdDeclarations,
                              _herdPath: TFileSystemPath): Promise<Array<IDeploymentPlan>> {
    let planLoadingPromises: Array<Promise<IDeploymentPlan>> = loadImageDeploymentPlans(images, herdSectionSpec)
    let imageDeploymentPlans: Array<IDeploymentPlan> = await Promise.all(planLoadingPromises)

    // TODO There should be no derived image deployment plans, migration actions should be a part of the image deployment plan
    let derivedPlanLoadingPromises = loadImageDeploymentPlans(derivedDeployments, herdSectionSpec)
    imageDeploymentPlans = imageDeploymentPlans.concat(await Promise.all(derivedPlanLoadingPromises))

    return await Promise.all(imageDeploymentPlans.flatMap(async (deploymentPlan) => {
      return deploymentPlan
    }))
  }

  return { imagesLoader }
}
