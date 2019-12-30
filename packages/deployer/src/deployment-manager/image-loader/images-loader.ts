import Bluebird = require("bluebird")
import {
  ILog,
  TDockerDeploymentAction,
  TDockerImageHerdSpec,
  TDockerImageHerdSpecs,
  TImageInformation,
  TK8sDockerImageDeploymentAction
} from "../deployment-types"
import { createImageDeploymentPlanner } from "./image-deployment-planner"
import { kubeSupportedExtensions } from "../kubectl-deployer/kube-supported-extensions"
import { TDockerImageReference } from "@shepherdorg/docker-image-metadata-loader/dist/local-image-metadata"
import { getShepherdMetadata } from "../add-shepherd-metadata"
import { identityMap, TFileSystemPath } from "../../basic-types"
import { ILoadDockerImageLabels } from "@shepherdorg/docker-image-metadata-loader"

export function splitDockerImageTag(dockerImageRefWithTag: string): { image: string; imagetag: string } {
  let colonIdx = dockerImageRefWithTag.indexOf(":")
  return {
    image: dockerImageRefWithTag.slice(0, colonIdx),
    imagetag: dockerImageRefWithTag.slice(colonIdx + 1, dockerImageRefWithTag.length),
  }
}

interface TImageDeclarationsLoaderDependencies {
  logger: ILog
  imageLabelsLoader: ILoadDockerImageLabels
}

export function ImagesLoader(injected: TImageDeclarationsLoaderDependencies) {
  let derivedDeployments: TDockerImageHerdSpecs = {}

  const calculateDeploymentPlan = createImageDeploymentPlanner({
    kubeSupportedExtensions,
    logger: injected.logger,
  }).calculateDeploymentActions


  function addMigrationImageToDependenciesPlan(imageMetaData: TImageInformation) {
    if (imageMetaData.shepherdMetadata && imageMetaData.shepherdMetadata.migrationImage) {
      derivedDeployments[imageMetaData.shepherdMetadata.migrationImage] = splitDockerImageTag(
        imageMetaData.shepherdMetadata.migrationImage,
      )
    }
    return imageMetaData
  }

  function loadImageMetadata(imageDef: TDockerImageReference) {
    return injected.imageLabelsLoader.getImageLabels(imageDef)
  }

  function loadDockerImageHerdSpecs(images: TDockerImageHerdSpecs) {
    return Object.entries(images).map(function([imgName, herdSpec]: [string, TDockerImageHerdSpec]) {
      herdSpec.key = imgName
      injected.logger.debug("Deployment image - loading image meta data for docker image", JSON.stringify(herdSpec))

      if (!herdSpec.image && herdSpec.dockerImage) {
        Object.assign(herdSpec, splitDockerImageTag(herdSpec.dockerImage))
      }
      let promise: Promise<Array<TDockerDeploymentAction | TK8sDockerImageDeploymentAction>> = loadImageMetadata(herdSpec)
        .then(getShepherdMetadata)
        .then(addMigrationImageToDependenciesPlan) /// This is pretty ugly, adding to external structure side effect
        .then(calculateDeploymentPlan)
        .catch(function(e: Error | string) {
          let errorMessage: string
          if (typeof e === "string") {
            console.error("Thrown error of type STRING!")
            console.error(e)
            errorMessage = e
          } else {
            errorMessage = "When processing image " + imgName + "\n" + e.message + (e.stack ? e.stack : "")
          }
          throw new Error(errorMessage)
        })
      return promise
    })
  }

  async function imagesLoader(images: TDockerImageHerdSpecs, _herdPath: TFileSystemPath ): Promise<Array<TDockerDeploymentAction | TK8sDockerImageDeploymentAction>> {
    let value: Array<Promise<Array<TDockerDeploymentAction | TK8sDockerImageDeploymentAction>>> = loadDockerImageHerdSpecs(images )
    let imageDeploymentPlans: Array<Array<TDockerDeploymentAction | TK8sDockerImageDeploymentAction>> = await Bluebird.all(value)

    let derivedDeploymentActionPromises = loadDockerImageHerdSpecs(derivedDeployments )
    imageDeploymentPlans = imageDeploymentPlans.concat(await Bluebird.all(derivedDeploymentActionPromises))

    return imageDeploymentPlans.flatMap((array) => array.map(identityMap))
  }


  return { imagesLoader }
}
