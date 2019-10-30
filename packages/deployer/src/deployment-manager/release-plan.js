const Promise = require("bluebird")

const path = require("path")
const fs = require("fs")
const options = require("./options")
const writeFile = Promise.promisify(fs.writeFile)
const _ = require("lodash")

const extendedExec = cmd => (...args) =>
  new Promise((res, rej) =>
    cmd.extendedExec(
      ...args,
      (error, errCode, stdOut) => {
        const err = new Error(error)
        err.errCode = errCode
        err.stdOut = stdOut
        rej(err)
      },
      res
    )
  )

module.exports = function(injected) {
  const stateStore = injected("stateStore")
  const cmd = injected("cmd")
  const logger = injected("logger")

  return function(forEnv) {
    if (!forEnv) {
      throw new Error(
        "must specify environment you are creating a deployment plan for"
      )
    }

    const k8sDeploymentPlan = {}
    const dockerDeploymentPlan = {}
    const k8sDeploymentsByIdentifier = {}

    function addK8sDeployment(deployment) {
      k8sDeploymentPlan[deployment.origin] = k8sDeploymentPlan[
        deployment.origin
      ] || {
        herdName: deployment.herdName,
        deployments: [],
      }
      k8sDeploymentPlan[deployment.origin].deployments.push(deployment)

      if (k8sDeploymentsByIdentifier[deployment.identifier]) {
        throw new Error(
          deployment.identifier +
            " is already in deployment plan from " +
            k8sDeploymentsByIdentifier[deployment.identifier].origin +
            ". When adding deployment from " +
            deployment.origin
        )
      }

      k8sDeploymentsByIdentifier[deployment.identifier] = deployment
    }

    function addDockerDeployer(deployment) {
      dockerDeploymentPlan[deployment.origin] = dockerDeploymentPlan[
        deployment.origin
      ] || {
        herdName: deployment.herdName,
        deployments: [],
      }

      function allButImageParameter(params) {
        return params.slice(0, params.length - 1)
      }

      deployment.descriptor = allButImageParameter(
        deployment.dockerParameters
      ).join(" ")
      dockerDeploymentPlan[deployment.origin].deployments.push(deployment)
    }

    function saveDeploymentState(deployment) {
      return stateStore.saveDeploymentState(deployment.state)
    }

    function getDeploymentStateFromStore(deployment) {
      logger.debug("Get deployment state ", { deployment })
      if (deployment.type === "k8s") {
        addK8sDeployment(deployment)
      } else if (deployment.type === "deployer") {
        addDockerDeployer(deployment)
      }

      return stateStore.getDeploymentState(deployment).then(function(state) {
        if (!deployment.type) {
          let message =
            "Illegal deployment, no deployment type attribute in " +
            JSON.stringify(deployment)
          reject(message)
        }
        if (!deployment.identifier) {
          let message =
            "Illegal deployment, no identifier attribute in " +
            JSON.stringify(deployment)
          reject(message)
        }

        deployment.state = state
        return deployment
      })
    }

    function K8sDeploymentPromises(deploymentOptions) {
      return Object.values(k8sDeploymentPlan).map(deploymentPlan => {
        return Promise.all(
          deploymentPlan.deployments.map(async deployment => {
            if (deployment.state.modified) {
              if (deploymentOptions.dryRun) {
                const writePath = path.join(
                  deploymentOptions.dryRunOutputDir,
                  deployment.operation +
                    "-" +
                    deployment.identifier.toLowerCase() +
                    ".yaml"
                )
                await writeFile(writePath, deployment.descriptor.trim())
                return deployment
              } else {
                try {
                  const stdOut = await extendedExec(cmd)(
                    "kubectl",
                    [deployment.operation, "-f", "-"],
                    {
                      env: process.env,
                      stdin: deployment.descriptor,
                      debug: true,
                    }
                  )
                  logger.info(
                    "kubectl " +
                      deployment.operation +
                      " deployments in " +
                      deployment.origin +
                      "/" +
                      deployment.identifier
                  )
                  logger.info(stdOut || "[empty output]")

                  try {
                    const state = await saveDeploymentState(deployment)
                    deployment.state = state
                    return deployment
                  } catch (err) {
                    throw "Failed to save state after successful deployment! " +
                      deployment.origin +
                      "/" +
                      deployment.identifier +
                      "\n" +
                      err
                  }
                } catch (error) {
                  if (typeof error === "string") throw error
                  const { errCode, stdOut, message: err } = error
                  if (deployment.operation === "delete") {
                    logger.info(
                      "kubectl " +
                        deployment.operation +
                        " deployments in " +
                        deployment.origin +
                        "/" +
                        deployment.identifier
                    )
                    logger.info(
                      "Error performing kubectl delete. Continuing anyway and updating deployment state as deleted. kubectl output follows."
                    )
                    logger.info(err || "[empty error]")
                    logger.info(stdOut || "[empty output]")

                    deployment.state.stdout = stdOut
                    deployment.state.stderr = err

                    try {
                      const state = await saveDeploymentState(deployment)
                      deployment.state = state
                      return deployment
                    } catch (err) {
                      throw "Failed to save state after error in deleting deployment! " +
                        deployment.origin +
                        "/" +
                        deployment.identifier +
                        "\n" +
                        err
                    }
                  } else {
                    let message =
                      "Failed to deploy from label for image " +
                      JSON.stringify(deployment)
                    message += "\n" + err
                    message += "\nCode:" + errCode
                    message += "\nStdOut:" + stdOut
                    throw message
                  }
                }
              }
            } else {
              logger.debug(
                deployment.identifier + " not modified, not deploying."
              )
              return undefined
            }
          })
        )
      })
    }

    function DeployerPromises(deploymentOptions) {
      return Object.values(dockerDeploymentPlan).map(deploymentPlan =>
        Promise.all(
          deploymentPlan.deployments.map(async deployment => {
            if (deployment.state.modified) {
              if (deploymentOptions.dryRun) {
                let writePath = path.join(
                  deploymentOptions.dryRunOutputDir,
                  deployment.imageWithoutTag.replace(/\//g, "_") +
                    "-deployer.txt"
                )

                let cmdLine = `docker run ${deployment.forTestParameters.join(
                  " "
                )}`

                await writeFile(writePath, cmdLine)
                return deployment
              } else {
                try {
                  const stdout = await extendedExec(cmd)(
                    "docker",
                    ["run"].concat(deployment.dockerParameters),
                    {
                      env: process.env,
                    }
                  )
                  try {
                    // logger.enterDeployment(deployment.origin + '/' + deployment.identifier);
                    logger.info(stdout)
                    // logger.exitDeployment(deployment.origin + '/' + deployment.identifier);

                    try {
                      const state = await saveDeploymentState(deployment)
                      deployment.state = state
                      return deployment
                    } catch (err) {
                      throw "Failed to save state after successful deployment! " +
                        deployment.origin +
                        "/" +
                        deployment.identifier +
                        "\n" +
                        err
                    }
                  } catch (e) {
                    console.error(
                      "Error running docker run" + JSON.stringify(deployment)
                    )
                    throw e
                  }
                } catch (err) {
                  let message =
                    "Failed to run docker deployer " +
                    JSON.stringify(deployment)
                  message += err
                  throw message
                }
              }
            } else {
              return undefined
            }
          })
        )
      )
    }

    function executePlan(runOptions) {
      runOptions = runOptions || { dryRun: false, dryRunOutputDir: undefined }
      let deploymentPromises = K8sDeploymentPromises(runOptions)
      deploymentPromises = deploymentPromises.concat(
        DeployerPromises(runOptions)
      )
      return Promise.all(deploymentPromises)
    }

    function printPlan(logger) {
      _.each(k8sDeploymentPlan, function(plan) {
        let modified = false
        if (plan.deployments) {
          _.each(plan.deployments, function(deployment) {
            if (deployment.state.modified) {
              if (!modified) {
                if (plan.herdName) {
                  logger.info(`From ${plan.herdName}`)
                } else {
                  logger.info("Missing herdName for ", plan)
                }
              }
              modified = true
              logger.info(
                `  -  will ${deployment.operation} ${deployment.identifier}`
              )
            }
          })
        }
        if (!modified) {
          logger.info("No modified deployments in " + plan.herdName)
        }
      })
      _.each(dockerDeploymentPlan, function(plan) {
        let modified = false
        if (plan.deployments) {
          _.each(plan.deployments, function(deployment) {
            if (deployment.state.modified) {
              logger.info(`${plan.herdName} deployer`)
              logger.info(
                `  -  will run ${deployment.identifier} ${deployment.command}`
              )
              modified = true
            }
          })
        }
        if (!modified) {
          logger.info("No modifications to " + plan.herdName)
        }
      })
    }

    function exportDeploymentDocuments(exportDirectory) {
      return new Promise(function(resolve, reject) {
        let fileWrites = []

        _.each(k8sDeploymentPlan, function(plan) {
          _.each(plan.deployments, function(deployment) {
            let writePath = path.join(
              exportDirectory,
              deployment.operation +
                "-" +
                deployment.identifier.toLowerCase() +
                ".yaml"
            )
            let writePromise = writeFile(
              writePath,
              deployment.descriptor.trim()
            )
            fileWrites.push(writePromise)
          })
        })
        _.each(dockerDeploymentPlan, function(plan) {
          _.each(plan.deployments, function(deployment) {
            let cmdLine = `docker run ${deployment.forTestParameters.join(" ")}`

            let writePath = path.join(
              exportDirectory,
              deployment.imageWithoutTag.replace(/\//g, "_") + "-deployer.txt"
            )
            let writePromise = writeFile(writePath, cmdLine)
            fileWrites.push(writePromise)
          })
        })
        Promise.all(fileWrites)
          .then(resolve)
          .catch(reject)
      })
    }

    return {
      addDeployment(deployment) {
        deployment.env = forEnv
        return getDeploymentStateFromStore(deployment)
      },
      executePlan: executePlan,
      printPlan: printPlan,
      exportDeploymentDocuments: exportDeploymentDocuments,
    }
  }
}
