import * as fs from "fs"
import * as path from "path"
import { emptyArray } from "../../helpers/ts-functions"
import { createKubectlDeployAction } from "./create-kubectl-deployment-action"

module.exports = function(injected) {
  const kubeSupportedExtensions = injected("kubeSupportedExtensions")
  const logger = injected("logger")

  function initDir(dirPath) {
    return {
      path: dirPath,
      files: {},
      subDirs: {},
      isDeploymentDir: false,
    }
  }

  function isDeploymentFile(filePath) {
    if (filePath.endsWith("images.yaml") || filePath.endsWith("herd.yaml")) {
      return false
    }
    return kubeSupportedExtensions[path.extname(filePath)]
  }

  let initialDir
  let scanDir = function(dir) {

    return new Promise(function(resolve, reject) {
      let planPromises = emptyArray<any>()

      function scanCompleted() {
        Promise.all(planPromises)
          .then(function(plans) {
            function flatten(arrayOfArrays) {
              let flattened = emptyArray<any>()
              arrayOfArrays.forEach(function(arrayOrObject) {
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

      if (!dir.path) {
        initialDir = dir
        dir = initDir(dir)
        dir.deploymentRoot = true
      }
      if (!scanCompleted) { // Very dubious code, this should always be true, function declared above
        throw new Error("Callback required! " + scanCompleted)
      }
      fs.readdir(dir.path, function(err, list) {
        if (err) reject(err)
        let pending = list.length
        if (!pending) scanCompleted()
        dir.forDelete = list.indexOf("shepherd-delete") > 0 // Delete marker-file present?
        list.forEach(function(unresolvedPath) {
          let resolvedPath = path.resolve(dir.path, unresolvedPath)

          fs.stat(resolvedPath, function(_err, stat) {
            function calculateFileDeploymentPlan(resolvedPath) {
              return new Promise(function(resolve, reject) {
                fs.readFile(resolvedPath, "utf-8", function(err, data) {
                  if (err) reject(err)

                  let dirName = path.basename(path.dirname(resolvedPath))
                  const fileName = path.basename(resolvedPath)

                  let imageVariableName = dirName.replace(/-/g, "_") + "_image"
                  if (process.env.hasOwnProperty(imageVariableName)) {
                    process.env.TPL_DOCKER_IMAGE =
                      process.env[imageVariableName]
                    if (process.env.TPL_DOCKER_IMAGE === "") {
                      dir.forDelete = true
                    }
                  }

                  const kubeDeploymentRelativePath = path.relative(initialDir, resolvedPath)
                  const deploymentAction = createKubectlDeployAction(kubeDeploymentRelativePath, data, logger)

                  if (process.env.hasOwnProperty(imageVariableName)) {
                    delete process.env.TPL_DOCKER_IMAGE
                  }

                  let deployment = {
                    operation: dir.forDelete ? "delete" : "apply",
                    identifier: deploymentAction.documentIdentifier,
                    version: "immutable",
                    descriptor: deploymentAction.deploymentDescriptor,
                    origin: deploymentAction.origin,
                    type: "k8s",
                    fileName: fileName
                  }
                  resolve(deployment)
                })
              });
            }

            if (stat && stat.isDirectory()) {
              let subDir = initDir(resolvedPath)
              let baseName = path.basename(resolvedPath)
              dir.subDirs[baseName] = subDir
              planPromises.push(
                scanDir(subDir)
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
                  dir.isDeploymentDir = true

                  planPromises.push(
                    calculateFileDeploymentPlan(resolvedPath)
                      .then(function(plan:any) {
                        dir.files[baseName] = {
                          modified: plan.modified,
                        }
                        if (!--pending) scanCompleted()
                        return plan
                      })
                      .catch(function(e) {
                        pending = -1
                        reject(new Error(
                          "Storing deployment state, for file " +
                            resolvedPath +
                            ":\n" +
                            e
                        ))
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
    });
  }

  return scanDir
}
