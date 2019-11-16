const fs = require("fs")
const path = require("path")
const expandEnv = require("../expandenv")
const expandtemplate = require("../expandtemplate")
const base64EnvSubst = require("../base64-env-subst").processLine

const identifyDocument = require("../k8s-deployment-document-identifier")
const applyClusterPolicies = require("../apply-k8s-policy").applyPoliciesToDoc

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
      let planPromises = []

      function scanCompleted() {
        Promise.all(planPromises)
          .then(function(plans) {
            function flatten(arrayOfArrays) {
              let flattened = []
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
      if (!scanCompleted) {
        throw new Error("Callback required!", scanCompleted)
      }
      fs.readdir(dir.path, function(err, list) {
        if (err) reject(err)
        let pending = list.length
        if (!pending) scanCompleted()
        dir.forDelete = list.indexOf("shepherd-delete") > 0 // Delete marker-file present?
        list.forEach(function(unresolvedPath) {
          let resolvedPath = path.resolve(dir.path, unresolvedPath)

          fs.stat(resolvedPath, function(err, stat) {
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

                  let lines = data.split("\n")
                  lines.forEach(function(line, idx) {
                    try {
                      lines[idx] = expandEnv(line, idx + 1)
                      lines[idx] = base64EnvSubst(lines[idx], {})
                    } catch (e) {
                      console.debug("Rejecting!", e)
                      reject(e)
                    }
                  })

                  let rawDoc = lines.join("\n")

                  rawDoc = expandtemplate(rawDoc)

                  if (process.env.hasOwnProperty(imageVariableName)) {
                    delete process.env.TPL_DOCKER_IMAGE
                  }

                  let deploymentDescriptor = applyClusterPolicies(
                    rawDoc,
                    logger
                  )

                  let documentIdentifier = identifyDocument(
                    deploymentDescriptor
                  ).identifyingString
                  let deployment = {
                    operation: dir.forDelete ? "delete" : "apply",
                    identifier: documentIdentifier,
                    version: "immutable",
                    descriptor: deploymentDescriptor,
                    origin: path.relative(initialDir, path.dirname(resolvedPath)),
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
                    reject("While scanning " + resolvedPath + ":" + scanErr)
                  })
              )
            } else {
              let baseName = path.basename(resolvedPath)
              try {
                if (isDeploymentFile(resolvedPath)) {
                  dir.isDeploymentDir = true

                  planPromises.push(
                    calculateFileDeploymentPlan(resolvedPath)
                      .then(function(plan) {
                        dir.files[baseName] = {
                          modified: plan.modified,
                        }
                        if (!--pending) scanCompleted()
                        return plan
                      })
                      .catch(function(e) {
                        pending = -1
                        reject(
                          "Storing deployment state, for file " +
                            resolvedPath +
                            ":\n" +
                            e
                        )
                      })
                  )
                } else {
                  if (!--pending) scanCompleted()
                }
              } catch (e) {
                pending = -1
                // Not well tested handling of this error
                console.error("Scan error", e)
                reject("In file " + resolvedPath + ":\n" + e, dir)
              }
            }
          })
        })
      })
    });
  }

  return scanDir
}
