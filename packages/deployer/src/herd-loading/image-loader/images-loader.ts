import {
  IDockerDeploymentAction,
  IK8sDockerImageDeploymentAction,
  ILog,
  TDockerImageHerdDeclaration,
  TDockerImageHerdDeclarations,
  THerdSectionDeclaration,
  TImageInformation,
} from "../../deployment-types"
import { createImageDeploymentPlanner } from "./image-deployment-planner"
import { kubeSupportedExtensions } from "../../deployment-actions/kubectl-deployer/kube-supported-extensions"
import { TDockerImageReference } from "@shepherdorg/docker-image-metadata-loader/dist/local-image-metadata"
import { extractShepherdMetadata } from "../add-shepherd-metadata"
import { TFileSystemPath } from "../../helpers/basic-types"
import { ILoadDockerImageLabels } from "@shepherdorg/docker-image-metadata-loader"
import { parseImageUrl, TDockerImageUrl, TDockerImageUrlStruct } from "../../helpers/parse-image-url"
import { IDeploymentPlan, IDeploymentPlanFactory } from "../../deployment-plan/deployment-plan-factory"
import { newProgrammerOops } from "oops-error"


export function parseDockerImageUrl(dockerImageUrl: TDockerImageUrl): TDockerImageUrlStruct {
  return parseImageUrl(dockerImageUrl)
}


interface TImageDeclarationsLoaderDependencies {
  logger: ILog
  imageLabelsLoader: ILoadDockerImageLabels
  planFactory : IDeploymentPlanFactory
}

export function ImagesLoader(injected: TImageDeclarationsLoaderDependencies) {
  let derivedDeployments: TDockerImageHerdDeclarations = {}

  function loadDockerImageHerdSpecs(images: TDockerImageHerdDeclarations, sectionDeclaration: THerdSectionDeclaration) {

    const createImageDeploymentActions = createImageDeploymentPlanner({
      kubeSupportedExtensions,
      logger: injected.logger,
      herdSectionDeclaration: sectionDeclaration,
    }).createDeploymentActions


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


  // Must unwrap and simplify this stuff
  async function imagesLoader(herdSectionSpec: THerdSectionDeclaration,
                              images: TDockerImageHerdDeclarations,
                              _herdPath: TFileSystemPath): Promise<Array<IDeploymentPlan>> {
    let value: Array<Promise<Array<IDockerDeploymentAction | IK8sDockerImageDeploymentAction>>> = loadDockerImageHerdSpecs(images, herdSectionSpec)
    let imageDeploymentActions: Array<Array<IDockerDeploymentAction | IK8sDockerImageDeploymentAction>> = await Promise.all(value)
    let derivedDeploymentActionPromises = loadDockerImageHerdSpecs(derivedDeployments, herdSectionSpec)
    imageDeploymentActions = imageDeploymentActions.concat(await Promise.all(derivedDeploymentActionPromises))

    let resultingPlans = await Promise.all(imageDeploymentActions.flatMap(async (deploymentActions) => {
      if(deploymentActions.length===0){
        throw newProgrammerOops("Zero actions loaded from herd section spec", herdSectionSpec)
      }

      const resultingPlan = injected.planFactory.createDeploymentPlan(deploymentActions[0].herdDeclaration)
      await Promise.all(deploymentActions.map(resultingPlan.addAction))
      return resultingPlan
    }))
    return resultingPlans
  }

  return { imagesLoader }
}
