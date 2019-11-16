import { THerdSpec } from "../deployment-types"
import { TK8sMetadata } from "@shepherdorg/metadata"
import { emptyArray } from "../../helpers/ts-functions"
import { TBranchModificationParams } from "./k8s-feature-deployment/create-name-change-index"
import * as path from "path"

import { options } from "../options"
import { createKubectlDeployAction } from "./create-kubectl-deployment-action"

const addResourceNameChangeIndex = require("./k8s-feature-deployment/create-name-change-index").addResourceNameChangeIndex

export interface TK8sDeploymentAction {
  herdSpec: THerdSpec
  metadata: TK8sMetadata

  operation: string
  identifier: string,
  version: string,
  descriptor: string // Deployment file contents
  origin: string,
  type: string,
  fileName: string,
  herdKey: string,
  deploymentRollouts: string[]
}

async function createImageBasedFileDeploymentAction(deploymentFileContent, imageInformation, fileName, branchModificationParams, logger): Promise<TK8sDeploymentAction> {
  let origin =
    imageInformation.imageDefinition.image + ":" + imageInformation.imageDefinition.imagetag + ":tar:" + fileName

  // Support mustache template expansion as well as envsubst template expansion

  if (options.testRunMode()) {
    process.env.TPL_DOCKER_IMAGE = "fixed-for-testing-purposes"
  } else {
    process.env.TPL_DOCKER_IMAGE =
      imageInformation.imageDefinition.image + ":" + imageInformation.imageDefinition.imagetag
  }

  const documentDeploymentAction = createKubectlDeployAction(origin, deploymentFileContent.content, logger, branchModificationParams)

  delete process.env.TPL_DOCKER_IMAGE

  // TODO: Create deployment action for each part of multipart deployment document

  const newK8sAction: TK8sDeploymentAction = {
    herdSpec: imageInformation.imageDefinition,
    metadata: imageInformation.shepherdMetadata,
    operation: imageInformation.imageDefinition.delete ? "delete" : "apply",
    identifier: documentDeploymentAction.documentIdentifier,
    version: imageInformation.imageDefinition.imagetag,
    descriptor: documentDeploymentAction.deploymentDescriptor, // Original descriptor file contents, may be multipart yaml
    origin: documentDeploymentAction.origin,
    type: "k8s",
    fileName: fileName,
    herdKey: imageInformation.imageDefinition.herdKey,
    deploymentRollouts: documentDeploymentAction.deploymentRollouts,
  }
  return newK8sAction
}

export function calculateKubectlActions(imageInformation, kubeSupportedExtensions, logger) {

  const shepherdMetadata: any = imageInformation.shepherdMetadata
  const herdKey: string = imageInformation.imageDefinition.herdKey
  const displayName: string = imageInformation.shepherdMetadata.displayName

  const plan: any = {
    herdKey: herdKey,
    displayName: displayName,
  }

  plan.files = shepherdMetadata.kubeDeploymentFiles
  plan.deployments = {}
  plan.dockerLabels = imageInformation.dockerLabels


  let deploymentActions = emptyArray<any>()

  let branchDeploymentEnabled = imageInformation.imageDefinition.featureDeployment

  const branchModificationParams: TBranchModificationParams = {
    shouldModify:false
  }

  if (branchDeploymentEnabled) {

    // console.log('featureDeploymentIsEnabled', branchDeploymentEnabled)
    branchModificationParams.ttlHours =
      imageInformation.imageDefinition.timeToLiveHours || branchModificationParams.ttlHours


    // Feature deployment specified in herdfile
    branchModificationParams.branchName = imageInformation.imageDefinition.branchName || imageInformation.imageDefinition.herdKey
    branchModificationParams.origin = imageInformation.imageDefinition.herdKey + "::" + branchModificationParams.branchName
    branchModificationParams.shouldModify = true

    if (imageInformation.isTargetForFeatureDeployment) {
      if (!Boolean(branchModificationParams.ttlHours)) {
        throw new Error(
          `${imageInformation.imageDefinition.herdKey}: Time to live must be specified either through FEATURE_TTL_HOURS environment variable or be declared using timeToLiveHours property in herd.yaml`,
        )
      }
      addResourceNameChangeIndex(
        plan,
        kubeSupportedExtensions,
        branchModificationParams,
      )
    }

  }


  Object.entries(plan.files as Array<any>).forEach(([fileName, deploymentFileContent]) => {
    if (!kubeSupportedExtensions[path.extname(fileName)]) {
      // console.debug('Unsupported extension ', path.extname(fileName));
      return
    }

    try {
      if (deploymentFileContent.content) {
        // let deployment = calculateFileDeploymentPlan();
        //
        // let addDeploymentPromise = releasePlan.addK8sDeployment(deployment);
        deploymentActions.push(
          createImageBasedFileDeploymentAction(deploymentFileContent, imageInformation, fileName, branchModificationParams, logger),
        )
      }
    } catch (e) {
      let error = "When processing " + fileName + ":\n"
      throw new Error(error + e.message)
    }
  })
  return Promise.all(deploymentActions)
}
