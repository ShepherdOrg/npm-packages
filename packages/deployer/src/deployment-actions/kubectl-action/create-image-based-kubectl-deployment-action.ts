import { emptyArray } from "../../helpers/ts-functions"
import { addResourceNameChangeIndex, TBranchModificationParams } from "./k8s-branch-deployment/create-name-change-index"
import * as path from "path"

import { shepherdOptions } from "../../shepherd-options"
import { ICreateKubectlDeploymentAction } from "./create-kubectl-deployment-action"
import { IK8sDockerImageDeploymentAction, ILog, TImageInformation, TK8sDeploymentPlan2 } from "../../deployment-types"
import { TExtensionsMap } from "./kube-supported-extensions"
import { TarFile, TK8sMetadata } from "@shepherdorg/metadata"
import { TFileSystemPath } from "../../helpers/basic-types"
import Bluebird = require("bluebird")

async function createImageBasedFileDeploymentAction(
  deploymentFileContent: TarFile,
  imageInformation: TImageInformation,
  fileName: TFileSystemPath,
  branchModificationParams: TBranchModificationParams,
  logger: ILog,
  env: string,
  deploymentActionFactory: ICreateKubectlDeploymentAction,
): Promise<IK8sDockerImageDeploymentAction> {
  let origin =
    imageInformation.imageDeclaration.image + ":" + imageInformation.imageDeclaration.imagetag + ":tar:" + fileName

  // Support mustache template expansion as well as envsubst template expansion

  if (shepherdOptions.testRunMode()) {
    process.env.TPL_DOCKER_IMAGE = "fixed-for-testing-purposes"
  } else {
    process.env.TPL_DOCKER_IMAGE =
      imageInformation.imageDeclaration.image + ":" + imageInformation.imageDeclaration.imagetag
  }

  let operation = imageInformation.imageDeclaration.delete ? "delete" : "apply"

  const documentDeploymentAction = deploymentActionFactory.createKubectlDeployAction(
    origin,
    deploymentFileContent.content,
    operation,
    fileName,
    logger,
    branchModificationParams,
  )

  delete process.env.TPL_DOCKER_IMAGE

  // TODO: Consider creating a deployment action for each part of multipart deployment document
  // Investigate whether kubernetes does clean up removed deployment sections from document.
  // Only do this if kubernetes in latest incarnations does not clean up.
  const newK8sAction: IK8sDockerImageDeploymentAction = Object.assign(documentDeploymentAction, {
    env: env,
    herdDeclaration: imageInformation.imageDeclaration,
    metadata: imageInformation.shepherdMetadata as TK8sMetadata,
    version: imageInformation.imageDeclaration.imagetag,
    type: "k8s",
    herdKey: imageInformation.imageDeclaration.key,
  })
  return newK8sAction
}

export function createKubectlDeploymentActions(
  imageInformation: TImageInformation,
  kubeSupportedExtensions: TExtensionsMap,
  logger: ILog,
  kubectlDeploymentActionFactory: ICreateKubectlDeploymentAction,
): Promise<Array<IK8sDockerImageDeploymentAction>> {
  const shepherdMetadata: any = imageInformation.shepherdMetadata
  const herdKey: string = imageInformation.imageDeclaration.key

  const displayName: string = imageInformation?.shepherdMetadata?.displayName || ""

  const plan: TK8sDeploymentPlan2 = {
    herdKey: herdKey,
    displayName: displayName,
  }

  plan.files = shepherdMetadata.kubeDeploymentFiles
  plan.deployments = {}
  // plan.dockerLabels = imageInformation.dockerLabels

  let deploymentActions = emptyArray<any>()

  let branchDeploymentEnabled = imageInformation.imageDeclaration.featureDeployment

  const branchModificationParams: TBranchModificationParams = {
    shouldModify: false,
  }

  if (branchDeploymentEnabled) {
    branchModificationParams.ttlHours =
      imageInformation.imageDeclaration.timeToLiveHours || branchModificationParams.ttlHours

    // Feature deployment specified in herdfile
    branchModificationParams.branchName =
      imageInformation.imageDeclaration.branchName || imageInformation.imageDeclaration.key
    branchModificationParams.origin =
      imageInformation.imageDeclaration.key + "::" + branchModificationParams.branchName
    branchModificationParams.shouldModify = true

    if (branchDeploymentEnabled) {
      if (!Boolean(branchModificationParams.ttlHours)) {
        throw new Error(
          `${imageInformation.imageDeclaration.key}: Time to live must be specified either through FEATURE_TTL_HOURS environment variable or be declared using timeToLiveHours property in herd.yaml`,
        )
      }
      addResourceNameChangeIndex(plan, kubeSupportedExtensions, branchModificationParams)
    }
  }

  if (plan.files) {
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
            createImageBasedFileDeploymentAction(archivedFile, imageInformation, fileName, branchModificationParams, logger, "", kubectlDeploymentActionFactory),
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
