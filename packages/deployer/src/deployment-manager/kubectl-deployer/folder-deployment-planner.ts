import * as fs from "fs"
import * as path from "path"
import { emptyArray } from "../../helpers/ts-functions"
import { createKubectlDeployAction } from "./create-kubectl-deployment-action"
import {
  ILog,
  TFolderHerdSpec,
  TFolderMetadata,
  TK8sDirDeploymentAction,
  TKubectlDeployAction,
} from "../deployment-types"
import { TFileSystemPath } from "../../basic-types"
import { TDeploymentType } from "@shepherdorg/metadata"

export interface TFolderDeploymentPlannerDependencies {
  logger: ILog
  kubeSupportedExtensions: any
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

export function planFolderDeployment(injected: TFolderDeploymentPlannerDependencies)  {
  const kubeSupportedExtensions = injected.kubeSupportedExtensions
  const logger = injected.logger

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

  function isDeploymentFile(filePath:TFileSystemPath) {
    if (filePath.endsWith("images.yaml") || filePath.endsWith("herd.yaml")) {
      return false
    }
    return kubeSupportedExtensions[path.extname(filePath)]
  }

  let initialDir: TFileSystemPath
  let scanDir = function(dir: TScanDirStruct | TFileSystemPath, herdSpec: TFolderHerdSpec): Promise<Array<TK8sDirDeploymentAction>> {
    return new Promise(function(resolve, reject) {
      let planPromises = emptyArray<any>()

      function scanCompleted() {
        Promise.all(planPromises)
          .then(function(plans) {
            function flatten(arrayOfArrays: Array<TK8sDirDeploymentAction | Array<TK8sDirDeploymentAction>>) {
              let flattened = emptyArray<TK8sDirDeploymentAction>()
              arrayOfArrays.forEach(function(arrayOrObject: Array<TK8sDirDeploymentAction> | TK8sDirDeploymentAction) {
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
            function calculateFileDeploymentPlan(resolvedPath: TFileSystemPath) {
              return new Promise(function(resolve, reject) {
                fs.readFile(resolvedPath, "utf-8", function(err, data) {
                  if (err) reject(err)

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
                  const deploymentAction: TKubectlDeployAction = createKubectlDeployAction(
                    kubeDeploymentRelativePath,
                    data,
                    dirStruct.forDelete ? "delete" : "apply",
                    logger
                  )

                  if (process.env.hasOwnProperty(imageVariableName)) {
                    delete process.env.TPL_DOCKER_IMAGE
                  }

                  let folderMetadata:TFolderMetadata = {
                    buildDate: stat.mtime.toISOString(),
                    deploymentType: TDeploymentType.Kubernetes,
                    displayName: fileName,
                    hyperlinks: [],
                    path: kubeDeploymentRelativePath,
                    semanticVersion: "none"
                  }
                  let deployment: TK8sDirDeploymentAction = Object.assign(deploymentAction, {
                    version: "immutable",
                    type: "k8s",
                    fileName: fileName,
                    herdSpec: herdSpec,
                    metadata: folderMetadata,
                    herdKey: herdSpec.key,
                    env: 'hardcoded' // TODO Get rid of env from this level of detail!

                  })
                  resolve(deployment)
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
                    reject(new Error("While scanning " + resolvedPath + ":" + scanErr))
                  })
              )
            } else {
              let baseName = path.basename(resolvedPath)
              try {
                if (isDeploymentFile(resolvedPath)) {
                  dirStruct.isDeploymentDir = true

                  planPromises.push(
                    calculateFileDeploymentPlan(resolvedPath)
                      .then(function(plan: any) {
                        dirStruct.files[baseName] = {
                          modified: plan.modified,
                        }
                        if (!--pending) scanCompleted()
                        return plan
                      })
                      .catch(function(e) {
                        pending = -1
                        reject(new Error("Storing deployment state, for file " + resolvedPath + ":\n" + e))
                      })
                  )
                } else {
                  if (!--pending) scanCompleted()
                }
              } catch (e) {
                pending = -1
                // Not well tested handling of this error is
                console.error("Scan error", e)
                reject(new Error("In file " + resolvedPath + ":\n" + e + dir))
              }
            }
          })
        })
      })
    })
  }

  return {
    scanDir
  }
}
