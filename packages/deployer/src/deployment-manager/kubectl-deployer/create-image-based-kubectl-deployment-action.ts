import { emptyArray } from "../../helpers/ts-functions"
import { addResourceNameChangeIndex, TBranchModificationParams } from "./k8s-branch-deployment/create-name-change-index"
import * as path from "path"

import { options } from "../options"
import { createKubectlDeployAction } from "./create-kubectl-deployment-action"
import {
  ILog,
  TImageInformation,
  TK8sDeploymentPlan2,
  TK8sDockerImageDeploymentAction,
} from "../deployment-types"
import Bluebird = require("bluebird")
import { TExtensionsMap } from "./kube-supported-extensions"
import { TarFile } from "@shepherdorg/metadata"
import { TFileSystemPath } from "../../basic-types"
import { TK8sMetadata } from "@shepherdorg/metadata"

// TODO: This file is badly covered in unit tests, especially branch deployments.

async function createImageBasedFileDeploymentAction(
  deploymentFileContent: TarFile,
  imageInformation: TImageInformation,
  fileName: TFileSystemPath,
  branchModificationParams:TBranchModificationParams,
  logger:ILog,
  env: string
): Promise<TK8sDockerImageDeploymentAction> {
  let origin =
    imageInformation.imageDefinition.image + ":" + imageInformation.imageDefinition.imagetag + ":tar:" + fileName

  // Support mustache template expansion as well as envsubst template expansion

  if (options.testRunMode()) {
    process.env.TPL_DOCKER_IMAGE = "fixed-for-testing-purposes"
  } else {
    process.env.TPL_DOCKER_IMAGE =
      imageInformation.imageDefinition.image + ":" + imageInformation.imageDefinition.imagetag
  }

  let operation = imageInformation.imageDefinition.delete ? "delete" : "apply"

  const documentDeploymentAction = createKubectlDeployAction(
    origin,
    deploymentFileContent.content,
    operation,
    logger,
    branchModificationParams
  )

  delete process.env.TPL_DOCKER_IMAGE

  // TODO: Create deployment action for each part of multipart deployment document

  const newK8sAction: TK8sDockerImageDeploymentAction = Object.assign(documentDeploymentAction, {
    env: env,
    herdSpec: imageInformation.imageDefinition,
    metadata: imageInformation.shepherdMetadata as TK8sMetadata,
    version: imageInformation.imageDefinition.imagetag,
    type: "k8s",
    fileName: fileName,
    herdKey: imageInformation.imageDefinition.key,
  })
  return newK8sAction
}

export function calculateKubectlActions(
  imageInformation:TImageInformation ,
  kubeSupportedExtensions: TExtensionsMap,
  logger:ILog
): Promise<Array<TK8sDockerImageDeploymentAction>> {
  const shepherdMetadata: any = imageInformation.shepherdMetadata
  const herdKey: string = imageInformation.imageDefinition.key

  const displayName: string = imageInformation?.shepherdMetadata?.displayName || ''

  const plan: TK8sDeploymentPlan2 = {
    herdKey: herdKey,
    displayName: displayName,
  }

  plan.files = shepherdMetadata.kubeDeploymentFiles
  plan.deployments = {}
  // plan.dockerLabels = imageInformation.dockerLabels

  let deploymentActions = emptyArray<any>()

  let branchDeploymentEnabled = imageInformation.imageDefinition.featureDeployment

  const branchModificationParams: TBranchModificationParams = {
    shouldModify: false,
  }

  if (branchDeploymentEnabled) {
    branchModificationParams.ttlHours =
      imageInformation.imageDefinition.timeToLiveHours || branchModificationParams.ttlHours

    // Feature deployment specified in herdfile
    branchModificationParams.branchName =
      imageInformation.imageDefinition.branchName || imageInformation.imageDefinition.key
    branchModificationParams.origin =
      imageInformation.imageDefinition.key + "::" + branchModificationParams.branchName
    branchModificationParams.shouldModify = true

    if (branchDeploymentEnabled) {
      if (!Boolean(branchModificationParams.ttlHours)) {
        throw new Error(
          `${imageInformation.imageDefinition.key}: Time to live must be specified either through FEATURE_TTL_HOURS environment variable or be declared using timeToLiveHours property in herd.yaml`
        )
      }
      addResourceNameChangeIndex(plan, kubeSupportedExtensions, branchModificationParams)
    }
  }

  if(plan.files){
    Object.entries(plan.files).forEach(([fileName, archivedFile]) => {
      if (!kubeSupportedExtensions[path.extname(fileName)]) {
        // console.debug('Unsupported extension ', path.extname(fileName));
        return
      }

      try {
        if (archivedFile.content) {
          // let deployment = calculateFileDeploymentPlan();
          //
          // let addDeploymentPromise = releasePlan.addK8sDeployment(deployment);
          deploymentActions.push(
            createImageBasedFileDeploymentAction(
              archivedFile,
              imageInformation,
              fileName,
              branchModificationParams,
              logger,
              ""
            )
          )
        }
      } catch (e) {
        let error = "When processing " + fileName + ":\n"
        throw new Error(error + e.message)
      }
    })
  }
  return Bluebird.all(deploymentActions)
}
