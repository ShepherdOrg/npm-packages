const Promise = require('bluebird');

const path = require('path');
const fs = require('fs');
const options = require('./options');
const writeFile = Promise.promisify(fs.writeFile);
const _ = require('lodash');

module.exports = function (injected) {

    const stateStore = injected('stateStore');
    const cmd = injected('cmd');
    const logger = injected('logger');

    return function () {
        const k8sDeploymentPlan = {};
        const dockerDeploymentPlan = {};
        const k8sDeploymentsByIdentifier = {};

        function addK8sDeployment(deployment) {
            k8sDeploymentPlan[deployment.origin] = k8sDeploymentPlan[deployment.origin] || {
                herdName: deployment.herdName,
                deployments: []
            };
            k8sDeploymentPlan[deployment.origin].deployments.push(deployment);

            if (k8sDeploymentsByIdentifier[deployment.identifier]) {
                throw new Error(deployment.identifier + ' is already in deployment plan from ' + k8sDeploymentsByIdentifier[deployment.identifier].origin + '. When adding deployment from ' + deployment.origin);
            }

            k8sDeploymentsByIdentifier[deployment.identifier] = deployment;
        }

        function addDockerDeployer(deployment) {
            dockerDeploymentPlan[deployment.origin] = dockerDeploymentPlan[deployment.origin] || {
                herdName: deployment.herdName,
                deployments: []
            };

            function allButImageParameter(params) {
                return params.slice(0, params.length - 1);
            }

            deployment.descriptor = allButImageParameter(deployment.dockerParameters).join(' ');
            dockerDeploymentPlan[deployment.origin].deployments.push(deployment);
        }

        function saveDeploymentState(deployment) {
            return stateStore.saveDeploymentState(deployment.state);
        }

        function getDeploymentState(deployment) {
            logger.debug('Get deployment state ', {deployment});
            if (deployment.type === 'k8s') {
                addK8sDeployment(deployment);
            } else if (deployment.type === 'deployer') {
                addDockerDeployer(deployment);
            }
            return new Promise(function (resolve, reject) {
                return stateStore.getDeploymentState(deployment).then(function (state) {
                    if (!deployment.type) {
                        let message = "Illegal deployment, no deployment type attribute in " + JSON.stringify(deployment);
                        reject(message);
                    }
                    if (!deployment.identifier) {
                        let message = "Illegal deployment, no identifier attribute in " + JSON.stringify(deployment);
                        reject(message);
                    }


                    deployment.state = state;
                    resolve(deployment);
                }).catch(reject);
            });
        }

        function K8sDeploymentPromises() {
            return _.map(k8sDeploymentPlan, function (deploymentPlan, identifier) {
                return Promise.map(deploymentPlan.deployments, function (deployment) {
                    if (deployment.state.modified) {

                        return new Promise(function (resolve, reject) {
                            // console.debug('Executing kubectl on deployment descriptor ', deployment.descriptor);
                            cmd.extendedExec("kubectl",
                                [deployment.operation, '-f', '-'],
                                {
                                    env: process.env,
                                    stdin: deployment.descriptor,
                                    debug: true
                                },
                                function (err, errCode, stdOut) {
                                    if(deployment.operation === 'delete'){
                                        try {
                                            logger.info('kubectl ' + deployment.operation + ' deployments in ' + deployment.origin + '/' + deployment.identifier);
                                            logger.info('Error performing kubectl delete. Continuing anyway and updating deployment state as deleted. kubectl output follows.');
                                            logger.info(err || '[empty error]');
                                            logger.info(stdOut || '[empty output]');

                                            deployment.state.stdout = stdOut;
                                            deployment.state.stderr = err;

                                            saveDeploymentState(deployment).then(function (savedState) {

                                                resolve(savedState, stdOut);

                                            }).catch(function (err) {
                                                reject("Failed to save state after error in deleting deployment! " + deployment.origin + '/' + deployment.identifier + '\n' + err)
                                            });

                                        } catch (e) {
                                            reject(e);
                                        }

                                    } else {
                                        let message = "Failed to deploy from label for image " + JSON.stringify(deployment);
                                        message += '\n' + err;
                                        message += '\nCode:' + errCode;
                                        message += '\nStdOut:' + stdOut;
                                        reject(message);
                                    }
                                },
                                function (stdout) {
                                    try {
                                        logger.info('kubectl ' + deployment.operation + ' deployments in ' + deployment.origin + '/' + deployment.identifier);
                                        logger.info(stdout || '[empty output]');

                                        saveDeploymentState(deployment).then(function (savedState) {

                                            resolve(savedState, stdout);

                                        }).catch(function (err) {
                                            reject("Failed to save state after successful deployment! " + deployment.origin + '/' + deployment.identifier + '\n' + err)
                                        });

                                    } catch (e) {
                                        reject(e);
                                    }
                                })
                        })

                    } else {
                        logger.debug(deployment.identifier + ' not modified, not deploying.');
                        return undefined;
                    }
                }, {concurrency: 8}); // TODO: Allow configurable concurrency ???

            });
        }

        function DeployerPromises() {
            return _.map(dockerDeploymentPlan, function (deploymentPlan, identifier) {
                return Promise.map(deploymentPlan.deployments, function (deployment) {
                    if (deployment.state.modified) {
                        return new Promise(function (resolve, reject) {
                            cmd.extendedExec("docker",
                                ['run'].concat(deployment.dockerParameters),
                                {
                                    env: process.env
                                },
                                function (err) {
                                    let message = "Failed to run docker deployer " + JSON.stringify(deployment);
                                    message += err;
                                    reject(message);
                                },
                                function (stdout) {
                                    try {
                                        // logger.enterDeployment(deployment.origin + '/' + deployment.identifier);
                                        logger.info(stdout);
                                        // logger.exitDeployment(deployment.origin + '/' + deployment.identifier);

                                        saveDeploymentState(deployment).then(function (savedState) {

                                            resolve(savedState, stdout);

                                        }).catch(function (err) {
                                            reject("Failed to save state after successful deployment! " + deployment.origin + '/' + deployment.identifier + '\n' + err)
                                        });

                                    } catch (e) {
                                        console.error('Error running docker run' + JSON.stringify(deployment));
                                        reject(e);
                                    }
                                })
                        })

                    } else {
                        return undefined;
                    }
                }, {concurrency: 1});

            });
        }

        function executePlan() {

            let combinedPlan = {dockerDeploymentPlan: dockerDeploymentPlan, k8sDeploymentPlan: k8sDeploymentPlan};

            if (options.dryRunMode()) {
                logger.info('Dry-run mode, release plan calculated, exported to /tmp/executingPlan.json');
                fs.writeFileSync('/tmp/executingPlan.json', JSON.stringify(combinedPlan));
                return new Promise(function (resolve, reject) {
                    resolve(combinedPlan);
                })
            } else {
                return new Promise(function (resolve, reject) {
                    let deploymentPromises = K8sDeploymentPromises();
                    deploymentPromises = deploymentPromises.concat(DeployerPromises());
                    Promise.all(deploymentPromises).then(function (deployments) {
                        resolve(deployments)
                    }).catch(reject);
                })
            }

        }

        function printPlan(logger) {
            _.each(k8sDeploymentPlan, function (plan) {
                let modified = false;
                if (plan.deployments) {
                    _.each(plan.deployments, function (deployment) {
                        if (deployment.state.modified) {
                            if (!modified) {
                                if (plan.herdName) {
                                    logger.info(`From ${plan.herdName}`);

                                } else {
                                    logger.info('Missing herdName for ', plan);
                                }
                            }
                            modified = true;
                            logger.info(`  -  will ${deployment.operation} ${deployment.identifier}`);
                        }
                    });
                }
                if (!modified) {
                    logger.info('No modified deployments in ' + plan.herdName);
                }
            });
            _.each(dockerDeploymentPlan, function (plan) {
                let modified = false;
                if (plan.deployments) {
                    _.each(plan.deployments, function (deployment) {
                        if (deployment.state.modified) {
                            logger.info(`${plan.herdName} deployer`);
                            logger.info(`  -  will run ${deployment.identifier} ${deployment.command}`);
                            modified = true;
                        }
                    });
                }
                if (!modified) {
                    logger.info('No modifications to ' + plan.herdName);
                }
            })
        }

        function exportDeploymentDocuments(exportDirectory) {
            return new Promise(function (resolve, reject) {
                let fileWrites = [];

                _.each(k8sDeploymentPlan, function (plan) {

                    _.each(plan.deployments, function (deployment) {
                        let writePath = path.join(exportDirectory, deployment.operation + '-' + deployment.identifier.toLowerCase() + '.yaml');
                        let writePromise = writeFile(writePath, deployment.descriptor.trim());
                        fileWrites.push(writePromise);
                    });
                });
                _.each(dockerDeploymentPlan, function (plan) {

                    _.each(plan.deployments, function (deployment) {
                        let cmdLine = `docker run ${deployment.forTestParameters.join(' ')}`;

                        let writePath = path.join(exportDirectory, deployment.imageWithoutTag.replace(/\//g, '_') + '-deployer.txt');
                        let writePromise = writeFile(writePath, cmdLine);
                        fileWrites.push(writePromise);

                    });
                });
                Promise.all(fileWrites).then(resolve).catch(reject);
            })
        }

        return {
            addDeployment(deployment) {
                return getDeploymentState(deployment);
            },
            executePlan: executePlan,
            printPlan: printPlan,
            exportDeploymentDocuments: exportDeploymentDocuments
        }

    };
};
