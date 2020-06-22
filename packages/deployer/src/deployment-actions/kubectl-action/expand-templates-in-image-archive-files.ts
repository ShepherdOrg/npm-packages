import { TK8sDeploymentPlan, TShepherdMetadata } from "../../deployment-types"
import { shepherdOptions } from "../../shepherd-options"
import { kubeSupportedExtensions } from "./kube-supported-extensions"
import * as path from "path"
import { expandEnvAndMustacheVariablesInFile } from "./kubectl-deployment-action-factory"
import * as chalk from "chalk"

export function expandTemplatesInImageArchiveFiles(imageInformation: TShepherdMetadata & { dockerLabels: { [p: string]: any } }, plan: TK8sDeploymentPlan) {
  if (shepherdOptions.testRunMode()) {
    process.env.TPL_DOCKER_IMAGE = "fixed-for-testing-purposes"
  } else {
    process.env.TPL_DOCKER_IMAGE =
      imageInformation.imageDeclaration.image + ":" + imageInformation.imageDeclaration.imagetag

  }

  if (!plan.files) {
    return
  }

  Object.entries(plan.files).forEach(([fileName, archivedFile]) => {
    if (!kubeSupportedExtensions[path.extname(fileName)]) {
      // console.debug('Unsupported extension ', path.extname(fileName));
      return
    }

    try {
      if (archivedFile.content) {
        archivedFile.content = expandEnvAndMustacheVariablesInFile(archivedFile.content)
      }
    } catch (e) {
      let message = `When expanding templates in ${chalk.blueBright(imageInformation.imageDeclaration.image)} ${chalk.red(fileName)}:\n${e.message}`
      throw new Error(message)
    }
  })
}
