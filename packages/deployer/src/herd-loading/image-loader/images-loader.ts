import Bluebird = require("bluebird")
import {
  ILog,
  IDockerDeploymentAction,
  TDockerImageHerdDeclaration,
  TDockerImageHerdSpecs, THerdSectionDeclaration,
  TImageInformation,
  IK8sDockerImageDeploymentAction,
} from "../../deployment-types"
import { createImageDeploymentPlanner } from "./image-deployment-planner"
import { kubeSupportedExtensions } from "../../deployment-actions/kubectl-deployer/kube-supported-extensions"
import { TDockerImageReference } from "@shepherdorg/docker-image-metadata-loader/dist/local-image-metadata"
import { extractShepherdMetadata } from "../add-shepherd-metadata"
import { TFileSystemPath } from "../../helpers/basic-types"
import { ILoadDockerImageLabels } from "@shepherdorg/docker-image-metadata-loader"
import { parseImageUrl, TDockerImageUrl, TDockerImageUrlStruct } from "../../helpers/parse-image-url"


export function parseDockerImageUrl(dockerImageUrl: TDockerImageUrl): TDockerImageUrlStruct {
  return parseImageUrl(dockerImageUrl)
}

interface TImageDeclarationsLoaderDependencies {
  logger: ILog
  imageLabelsLoader: ILoadDockerImageLabels
}

export function ImagesLoader(injected: TImageDeclarationsLoaderDependencies) {
  let derivedDeployments: TDockerImageHerdSpecs = {}


  function loadDockerImageHerdSpecs(images: TDockerImageHerdSpecs, sectionDeclaration: THerdSectionDeclaration) {

    const createImageDeploymentActions = createImageDeploymentPlanner({
      kubeSupportedExtensions,
      logger: injected.logger,
      herdSectionDeclaration: sectionDeclaration
    }).createDeploymentActions


    function addMigrationImageToDependenciesPlan(imageMetaData: TImageInformation) {
      if (imageMetaData.shepherdMetadata && imageMetaData.shepherdMetadata.migrationImage) {
        let dockerImageTag = parseDockerImageUrl(
          imageMetaData.shepherdMetadata.migrationImage,
        )
        derivedDeployments[imageMetaData.shepherdMetadata.migrationImage] = {sectionDeclaration: sectionDeclaration, ...dockerImageTag}
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
      let promise: Promise<Array<IDockerDeploymentAction | IK8sDockerImageDeploymentAction>> = loadImageMetadata(herdSpec)
        .then(extractShepherdMetadata)
        .then(addMigrationImageToDependenciesPlan)
        .then(createImageDeploymentActions)
        .catch(function(e: Error | string) {
          let errorMessage: string
          if (typeof e === "string") {
            console.error("Thrown error of type STRING!")
            console.error(e)
            errorMessage = e
          } else {
            errorMessage = "When processing image " + imgName + "\n" + e.message
          }
          throw new Error(errorMessage)
        })
      return promise
    })
  }

  async function imagesLoader(herdSectionSpec: THerdSectionDeclaration, images: TDockerImageHerdSpecs, _herdPath: TFileSystemPath ): Promise<Array<IDockerDeploymentAction | IK8sDockerImageDeploymentAction>> {
      let value: Array<Promise<Array<IDockerDeploymentAction | IK8sDockerImageDeploymentAction>>> = loadDockerImageHerdSpecs( images , herdSectionSpec)
      let imageDeploymentPlans: Array<Array<IDockerDeploymentAction | IK8sDockerImageDeploymentAction>> = await Bluebird.all(value)
      let derivedDeploymentActionPromises = loadDockerImageHerdSpecs(derivedDeployments, herdSectionSpec)
      imageDeploymentPlans = imageDeploymentPlans.concat(await Bluebird.all(derivedDeploymentActionPromises))
      return imageDeploymentPlans.flatMap((array) => array.map((imageDeploymentAction: IDockerDeploymentAction | IK8sDockerImageDeploymentAction)=>{
        return imageDeploymentAction
      }))
  }
  return { imagesLoader }
}
