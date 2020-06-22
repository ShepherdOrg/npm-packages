import { emptyArray } from "../../helpers/ts-functions"
import { addResourceNameChangeIndex, TBranchModificationParams } from "./k8s-branch-deployment/create-name-change-index"
import * as path from "path"

import { shepherdOptions } from "../../shepherd-options"
import { ICreateKubectlDeploymentAction } from "./kubectl-deployment-action-factory"
import { IDockerImageKubectlDeploymentAction, TImageInformation, TK8sDeploymentPlan } from "../../deployment-types"
import { kubeSupportedExtensions } from "./kube-supported-extensions"
import { TarFile, TK8sMetadata } from "@shepherdorg/metadata"
import { TFileSystemPath } from "../../helpers/basic-types"
import { ILog } from "../../logging/logger"
import * as chalk from "chalk"
import { expandTemplatesInImageArchiveFiles } from "./expand-templates-in-image-archive-files"
import Bluebird = require("bluebird")

export type ICreateDockerImageKubectlDeploymentActions = {
  createKubectlDeploymentActions: (
    imageInformation: TImageInformation,
  ) => Promise<Array<IDockerImageKubectlDeploymentAction>>
}

export type TActionFactoryDependencies = {
  environment: string
  deploymentActionFactory: ICreateKubectlDeploymentAction
  logger: ILog
}

export function createDockerImageKubectlDeploymentActionsFactory(injected: TActionFactoryDependencies): ICreateDockerImageKubectlDeploymentActions {
  async function createImageBasedFileDeploymentAction(
    deploymentFileContent: TarFile,
    imageInformation: TImageInformation,
    fileName: TFileSystemPath,
    branchModificationParams: TBranchModificationParams,
    env: string,
    deploymentActionFactory: ICreateKubectlDeploymentAction,
  ): Promise<IDockerImageKubectlDeploymentAction> {
    let origin =
      imageInformation.imageDeclaration.image + ":" + imageInformation.imageDeclaration.imagetag + ":tar:" + fileName

    // TODO REMOVE AFTER REFACTOR
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
      branchModificationParams,
    )

    delete process.env.TPL_DOCKER_IMAGE

    // TODO: Consider creating a deployment action for each part of multipart deployment document
    // Investigate whether kubernetes does clean up removed deployment sections from document.
    // Only do this if kubernetes in latest incarnations does not clean up.
    return Object.assign(documentDeploymentAction, {
      env: env,
      herdDeclaration: imageInformation.imageDeclaration,
      metadata: imageInformation.shepherdMetadata as TK8sMetadata,
      version: imageInformation.imageDeclaration.imagetag,
      type: "k8s",
      herdKey: imageInformation.imageDeclaration.key,
    })
  }

  function createKubectlDeploymentActions(
    imageInformation: TImageInformation,
  ): Promise<Array<IDockerImageKubectlDeploymentAction>> {
    const shepherdMetadata: any = imageInformation.shepherdMetadata
    const herdKey: string = imageInformation.imageDeclaration.key

    const displayName: string = imageInformation?.shepherdMetadata?.displayName || ""

    const plan: TK8sDeploymentPlan = {
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

    process.env.BRANCH_NAME = ""
    process.env.BRANCH_NAME_PREFIX = ""
    process.env.BRANCH_NAME_POSTFIX = ""

    if (branchDeploymentEnabled) {
      branchModificationParams.ttlHours =
        imageInformation.imageDeclaration.timeToLiveHours || branchModificationParams.ttlHours

      // Feature deployment specified in herdfile
      branchModificationParams.branchName =
        imageInformation.imageDeclaration.branchName || imageInformation.imageDeclaration.key
      branchModificationParams.origin =
        imageInformation.imageDeclaration.key + "::" + branchModificationParams.branchName
      branchModificationParams.shouldModify = true

      // Lets add branch deployment variables to environment here

      if (branchModificationParams && branchModificationParams.shouldModify) {
        process.env.BRANCH_NAME = branchModificationParams.branchName
        process.env.BRANCH_NAME_PREFIX = `${branchModificationParams.branchName}-`
        process.env.BRANCH_NAME_POSTFIX = `-${branchModificationParams.branchName}`
      }
      if (!Boolean(branchModificationParams.ttlHours)) {
        throw new Error(
          `${imageInformation.imageDeclaration.key}: Time to live must be specified either through FEATURE_TTL_HOURS environment variable or be declared using timeToLiveHours property in herd.yaml`,
        )
      }
    }

    if (plan.files) {
      expandTemplatesInImageArchiveFiles(imageInformation, plan)
    }

    if (branchDeploymentEnabled) {
      addResourceNameChangeIndex(plan, branchModificationParams)
    }

    if (plan.files) {
      Object.entries(plan.files).forEach(([fileName, archivedFile]) => {
        if (!kubeSupportedExtensions[path.extname(fileName)]) {
          // console.debug('Unsupported extension ', path.extname(fileName));
          return
        }

        try {
          if (archivedFile.content) {

            deploymentActions.push(
              createImageBasedFileDeploymentAction(
                archivedFile,
                imageInformation,
                fileName,
                branchModificationParams,
                injected.environment,
                injected.deploymentActionFactory,
              ),
            )
          }
        } catch (e) {
          let message = `When processing ${chalk.red(fileName)}:\n${e.message}`
          throw new Error(message)
        }
      })
    }
    return Bluebird.all(deploymentActions)
  }

  return {
    createKubectlDeploymentActions,
  }
}
