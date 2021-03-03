import * as fs from "fs"
import * as path from "path"
import { emptyArray } from "../../helpers/ts-functions"
import {
  expandEnvAndMustacheVariablesInFile,
  ICreateKubectlDeploymentAction,
} from "../../deployment-actions/kubectl-action/kubectl-deployment-action-factory"
import {
  IK8sDirDeploymentAction,
  IKubectlDeployAction,
  TFolderHerdDeclaration,
  TFolderMetadata,
} from "../../deployment-types"
import { TFileSystemPath } from "../../helpers/basic-types"
import { TDeploymentType } from "@shepherdorg/metadata"
import { kubeSupportedExtensions } from "../../deployment-actions/kubectl-action/kube-supported-extensions"
import { ILog } from "@shepherdorg/logger"
import * as chalk from "chalk"

export interface ICreateKubectlActionsForFolderStructure {
  scanDir: (
    dir: TScanDirStruct | TFileSystemPath,
    herdSpec: TFolderHerdDeclaration
  ) => Promise<Array<IK8sDirDeploymentAction>>
}

export interface TFolderActionFactoryDependencies {
  environment: string
  logger: ILog
  kubectlDeploymentActionFactory: ICreateKubectlDeploymentAction
}

type TFilePlanStruct = {}
type TFileMap = { [index: string]: TFilePlanStruct }

type TSubDirMap = { [index: string]: TScanDirStruct }

type TScanDirStruct = {
  forDelete: boolean
  path: TFileSystemPath
  files: TFileMap
  subDirs: TSubDirMap
  isDeploymentDir: boolean
  deploymentRoot: boolean
}

function isScanDirStruct(dir: TFileSystemPath | TScanDirStruct): dir is TScanDirStruct {
  return Boolean((dir as TScanDirStruct).path)
}

export function createFolderActionFactory(
  injected: TFolderActionFactoryDependencies
): ICreateKubectlActionsForFolderStructure {
  function initDir(dirPath: TFileSystemPath): TScanDirStruct {
    return {
      deploymentRoot: false,
      forDelete: false,
      path: dirPath,
      files: {},
      subDirs: {},
      isDeploymentDir: false,
    }
  }

  function isDeploymentFile(filePath: TFileSystemPath) {
    if (filePath.endsWith("images.yaml") || filePath.endsWith("herd.yaml")) {
      return false
    }
    return kubeSupportedExtensions[path.extname(filePath)]
  }

  let initialDir: TFileSystemPath
  let scanDir = function(
    dir: TScanDirStruct | TFileSystemPath,
    herdSpec: TFolderHerdDeclaration
  ): Promise<Array<IK8sDirDeploymentAction>> {
    return new Promise(function(resolve, reject) {
      let planPromises = emptyArray<any>()

      function scanCompleted() {
        Promise.all(planPromises)
          .then(function(plans) {
            function flatten(arrayOfArrays: Array<IK8sDirDeploymentAction | Array<IK8sDirDeploymentAction>>) {
              let flattened = emptyArray<IK8sDirDeploymentAction>()
              arrayOfArrays.forEach(function(arrayOrObject: Array<IK8sDirDeploymentAction> | IK8sDirDeploymentAction) {
                if (Array.isArray(arrayOrObject)) {
                  flattened = flattened.concat(flatten(arrayOrObject))
                } else {
                  flattened.push(arrayOrObject)
                }
              })
              return flattened
            }

            resolve(flatten(plans))
          })
          .catch(reject)
      }

      let dirStruct: TScanDirStruct
      if (!isScanDirStruct(dir)) {
        initialDir = dir
        dirStruct = initDir(dir)
        dirStruct.deploymentRoot = true
      } else {
        dirStruct = dir
      }
      if (!scanCompleted) {
        // Very dubious code, this should always be true, function declared above
        throw new Error("Callback required! " + scanCompleted)
      }
      fs.readdir(dirStruct.path, function(err, list) {
        if (err) reject(err)
        let pending = list.length
        if (!pending) scanCompleted()
        dirStruct.forDelete = list.indexOf("shepherd-delete") > 0 // Delete marker-file present?
        list.forEach(function(unresolvedPath) {
          let resolvedPath: string = path.resolve(dirStruct.path, unresolvedPath)
          fs.stat(resolvedPath, function(_err, stat) {
            function constructFileDeploymentPlan(resolvedPath: TFileSystemPath) {
              return new Promise(function(resolve, reject) {
                fs.readFile(resolvedPath, "utf-8", function(err, data) {
                  if (err) return reject(err)

                  let dirName = path.basename(path.dirname(resolvedPath))
                  const fileName = path.basename(resolvedPath)

                  let imageVariableName = dirName.replace(/-/g, "_") + "_image"
                  if (process.env.hasOwnProperty(imageVariableName)) {
                    process.env.TPL_DOCKER_IMAGE = process.env[imageVariableName]
                    if (process.env.TPL_DOCKER_IMAGE === "") {
                      dirStruct.forDelete = true
                    }
                  }

                  const kubeDeploymentRelativePath = path.relative(initialDir, resolvedPath)

                  try {
                    data = expandEnvAndMustacheVariablesInFile(data)
                    const deploymentAction: IKubectlDeployAction = injected.kubectlDeploymentActionFactory.createKubectlDeployAction(
                      kubeDeploymentRelativePath,
                      data,
                      dirStruct.forDelete ? "delete" : "apply",
                      fileName
                    )

                    if (process.env.hasOwnProperty(imageVariableName)) {
                      delete process.env.TPL_DOCKER_IMAGE
                    }

                    let folderMetadata: TFolderMetadata = {
                      buildDate: stat.mtime.toISOString(),
                      deploymentType: TDeploymentType.Kubernetes,
                      displayName: fileName,
                      hyperlinks: [],
                      path: kubeDeploymentRelativePath,
                      semanticVersion: "none",
                    }
                    let deployment: IK8sDirDeploymentAction = Object.assign(deploymentAction, {
                      version: "immutable",
                      type: "k8s",
                      herdDeclaration: herdSpec,
                      metadata: folderMetadata,
                      herdKey: herdSpec.key,
                      env: injected.environment,
                    })
                    resolve(deployment)
                  } catch (err) {
                    return reject(err)
                  }
                })
              })
            }

            if (stat && stat.isDirectory()) {
              let subDir = initDir(resolvedPath)
              let baseName = path.basename(resolvedPath)
              dirStruct.subDirs[baseName] = subDir
              planPromises.push(
                scanDir(subDir, herdSpec)
                  .then(function(plans) {
                    if (!--pending) scanCompleted()
                    return plans
                  })
                  .catch(function(scanErr) {
                    reject(new Error("While scanning " + chalk.blueBright(resolvedPath) + ":" + scanErr.message))
                  })
              )
            } else {
              let baseName = path.basename(resolvedPath)
              try {
                if (isDeploymentFile(resolvedPath)) {
                  dirStruct.isDeploymentDir = true

                  planPromises.push(
                    constructFileDeploymentPlan(resolvedPath)
                      .then(function(plan: any) {
                        dirStruct.files[baseName] = {
                          modified: plan.modified,
                        }
                        if (!--pending) scanCompleted()
                        return plan
                      })
                      .catch(function(e) {
                        pending = -1
                        reject(
                          new Error(`While constructing deployment plan for file ${chalk.blueBright(resolvedPath)}:
${e.message}`)
                        )
                      })
                  )
                } else {
                  if (!--pending) scanCompleted()
                }
              } catch (e) {
                pending = -1
                // Not well tested handling of this error is
                console.error("Scan error", e)
                reject(new Error("In file " + chalk.blueBright(resolvedPath) + ":\n" + e + dir))
              }
            }
          })
        })
      })
    })
  }

  return {
    scanDir,
  }
}
