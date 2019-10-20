const untarBase64String = require('../untar-string');
const identifyDocument = require('../k8s-deployment-document-identifier');

const expandEnv = require('../expandenv');
const expandtemplate = require('../expandtemplate');

const applyClusterPolicies = require('../apply-k8s-policy').applyPoliciesToDoc;
const JSYAML = require('js-yaml');
const yamlLoad = require('../k8s-feature-deployment/multipart-yaml-load');
const modifyDeploymentDocument = require('../k8s-feature-deployment/modify-deployment-document').modifyRawDocument;
const base64EnvSubst = require('../base64-env-subst').processLine;
const options = require('./options');
const path = require('path');
const _ = require('lodash');

const extractShepherdMetadata = require('@shepherdorg/metadata/dist/dockerLabelParser').extractShepherdMetadata;

module.exports = function (injected) {
    const kubeSupportedExtensions = injected('kubeSupportedExtensions');

    function calculateFileDeploymentPlan (deploymentFileContent, imageMetadata, fileName, featureDeploymentConfig) {
        return new Promise(function (resolve, reject) {
            let origin = imageMetadata.imageDefinition.image + ':' + imageMetadata.imageDefinition.imagetag + ':kube.config.tar.base64';

            // Support mustache template expansion as well as envsubst template expansion

            let lines = deploymentFileContent.content.split('\n');
            let fileContents;
            try {
                if (options.testRunMode()) {
                    process.env.TPL_DOCKER_IMAGE = 'fixed-for-testing-purposes';
                } else {
                    process.env.TPL_DOCKER_IMAGE = imageMetadata.imageDefinition.image + ':' + imageMetadata.imageDefinition.imagetag;
                }
                _.each(lines, function (line, idx) {
                    try {
                        lines[idx] = expandEnv(line);
                        lines[idx] = base64EnvSubst(lines[idx], {});
                    } catch (error) {

                        let message = `Error expanding variables in line #${idx}: ${line}\n`;
                        message += error;
                        throw new Error(message);
                    }
                });
                fileContents = lines.join('\n');
                fileContents = expandtemplate(fileContents);

                delete process.env.TPL_DOCKER_IMAGE;
            } catch (error) {
                // console.error( error)
                // console.log('ORIGINAL MESSAGE', error.message)

                let message = `In deployment image ${origin}\n In file ${fileName} \n`;
                message += error.message;

                let augmentedError = new Error(message);

                augmentedError.cause = error;
                reject(augmentedError);
                return;
            }
            if (featureDeploymentConfig.isFeatureDeployment) {
                fileContents = modifyDeploymentDocument(fileContents, {
                    ttlHours: imageMetadata.imageDefinition.timeToLiveHours,
                    newName: featureDeploymentConfig.newName,
                    nameReferenceChanges: featureDeploymentConfig.nameReferenceChanges
                });
                origin = featureDeploymentConfig.origin;
            }

            let deploymentDescriptor = applyClusterPolicies(fileContents);

            let documentIdentifier = identifyDocument(deploymentDescriptor);

            let plan = {
                operation: imageMetadata.imageDefinition.delete ? 'delete' : 'apply',
                identifier: documentIdentifier,
                version: imageMetadata.imageDefinition.imagetag,
                descriptor: deploymentDescriptor,
                origin: origin,
                type: 'k8s',
                fileName: fileName,
                herdName: imageMetadata.imageDefinition.herdName
            };
            resolve(plan);

        });
    }

    function getKubeConfigTarLabel (imageMetadata) {
        return imageMetadata.dockerLabels['shepherd.kube.config.tar.base64'];
    }

    function rewriteDockerLabels (imageMetadata, obsoleteQualifier, newQualifier) {
        _(imageMetadata.dockerLabels).keys().each((dockerLabelKey) => {
            if (dockerLabelKey.startsWith(obsoleteQualifier)) {
                const newKey = dockerLabelKey.replace(obsoleteQualifier, newQualifier);
                imageMetadata.dockerLabels[newKey] = imageMetadata.dockerLabels[dockerLabelKey];
                delete imageMetadata.dockerLabels[dockerLabelKey];
            }
        });
    }

    function calculateImagePlan (imageMetadata) {
        if (imageMetadata.dockerLabels) {

            rewriteDockerLabels(imageMetadata, 'is.icelandairlabs', 'shepherd');

            return extractShepherdMetadata(imageMetadata.dockerLabels).then((shepherdMetadata) => {
                let plan = {
                    displayName: shepherdMetadata.displayName,
                    herdName: imageMetadata.imageDefinition.herdName // TODO Rename imageDefinition -> herdDeclaration
                };

                if (shepherdMetadata.deploymentType ==='deployer') {

                    let dockerImageWithVersion = imageMetadata.imageDefinition.dockerImage || (imageMetadata.imageDefinition.image + ':' + imageMetadata.imageDefinition.imagetag);

                    Object.assign(plan, {
                        dockerParameters: ['-i', '--rm', '-e', expandEnv('ENV=${ENV}')],
                        forTestParameters: undefined,
                        imageWithoutTag: dockerImageWithVersion.replace(/:.*/g, ''), // For regression testing
                        origin: plan.herdName,
                        type: 'deployer',
                        operation: 'run',
                        command: 'deploy',
                        identifier: plan.herdName,
                    });

                    let envList = [];

                    plan.command = shepherdMetadata.deployCommand || plan.command;
                    if (shepherdMetadata.environmentVariablesExpansionString) {
                        const envLabel = expandEnv(shepherdMetadata.environmentVariablesExpansionString);
                        envList = envList.concat(envLabel.split(','));
                    }

                    envList.forEach(function (env_item) {
                        plan.dockerParameters.push('-e');
                        plan.dockerParameters.push((env_item));
                    });

                    plan.forTestParameters = plan.dockerParameters.slice(0); // Clone array

                    plan.dockerParameters.push(dockerImageWithVersion);
                    plan.forTestParameters.push(plan.imageWithoutTag + ':[image_version]');

                    if (plan.command) {
                        plan.dockerParameters.push(plan.command);
                        plan.forTestParameters.push(plan.command);
                    }

                } else {

                    if (shepherdMetadata.deploymentType ==='k8s') {

                        const files = shepherdMetadata.kubeDeploymentFiles;

                        plan.files = files;
                        plan.deployments = {};
                        plan.dockerLabels = imageMetadata.dockerLabels;
                        let planPromises = [];
                        let nameReferenceChanges = {};
                        let featureDeploymentConfig = {
                            isFeatureDeployment: false
                        };

                        if (process.env.UPSTREAM_IMAGE_NAME === imageMetadata.imageDefinition.herdName && process.env.FEATURE_NAME) {
                            let cleanedName = process.env.FEATURE_NAME.replace(/\//g, '--').toLowerCase();
                            featureDeploymentConfig.isFeatureDeployment = true;
                            featureDeploymentConfig.ttlHours = process.env.FEATURE_TTL_HOURS;
                            featureDeploymentConfig.newName = cleanedName;
                            featureDeploymentConfig.origin = imageMetadata.imageDefinition.herdName + '::' + cleanedName;
                        }

                        if (imageMetadata.imageDefinition.featureDeployment) {
                            featureDeploymentConfig.isFeatureDeployment = true;
                            featureDeploymentConfig.ttlHours = imageMetadata.imageDefinition.timeToLiveHours;
                            featureDeploymentConfig.newName = imageMetadata.imageDefinition.herdName;
                            featureDeploymentConfig.origin = imageMetadata.imageDefinition.herdName + '::feature';
                        }

                        if (featureDeploymentConfig.isFeatureDeployment) {
                            _.forEach(plan.files, function (deploymentFileContent, fileName) {
                                let fileExtension = path.extname(fileName);
                                if(!fileExtension){
                                    return
                                }
                                if (!kubeSupportedExtensions[fileExtension]) {
                                    console.debug(`Unsupported extension ${fileExtension} on file ${fileName}`);
                                    return;
                                }

                                if (deploymentFileContent.content) {
                                    let parsedMultiContent = yamlLoad(deploymentFileContent.content);
                                    _.forEach(parsedMultiContent, function (parsedContent) {
                                        if (parsedContent) {
                                            nameReferenceChanges[parsedContent.kind] = nameReferenceChanges[parsedContent.kind] || {};
                                            nameReferenceChanges[parsedContent.kind][parsedContent.metadata.name] = parsedContent.metadata.name + '-' + featureDeploymentConfig.newName;
                                        } else {
                                            console.warn('Parsed content is NULL!!!', deploymentFileContent.content);
                                        }
                                    });
                                }
                            });
                            featureDeploymentConfig.nameReferenceChanges = nameReferenceChanges;
                        }

                        _.forEach(plan.files, function (deploymentFileContent, fileName) {
                            if (!kubeSupportedExtensions[path.extname(fileName)]) {
                                // console.debug('Unsupported extension ', path.extname(fileName));
                                return;
                            }

                            try {
                                if (deploymentFileContent.content) {
                                    // let deployment = calculateFileDeploymentPlan();
                                    //
                                    // let addDeploymentPromise = releasePlan.addK8sDeployment(deployment);
                                    planPromises.push(calculateFileDeploymentPlan(deploymentFileContent, imageMetadata, fileName, featureDeploymentConfig));

                                }
                            } catch (e) {
                                let error = 'When processing ' + fileName + ':\n';
                                reject(error + e);
                            }
                        });
                        return Promise.all(planPromises)

                    } else {
                        throw new Error(`FALLING THROUGH ${(shepherdMetadata.displayName)} - ${(shepherdMetadata.deploymentType)}`)
                    }

                }

                return [plan];
            });

        } else {
            return new Promise(function (resolve, reject) {

                rewriteDockerLabels(imageMetadata, 'is.icelandairlabs', 'shepherd');

                let plan = {
                    herdName: imageMetadata.imageDefinition.herdName
                };

                if (imageMetadata.dockerLabels) {

                    if (getKubeConfigTarLabel(imageMetadata)) {
                        let deploymentFilesArchive = getKubeConfigTarLabel(imageMetadata);
                        untarBase64String(deploymentFilesArchive).then(function (files) {
                            plan.files = files;
                            plan.deployments = {};
                            plan.dockerLabels = imageMetadata.dockerLabels;
                            let planPromises = [];
                            let nameReferenceChanges = {};
                            let featureDeploymentConfig = {
                                isFeatureDeployment: false
                            };

                            if (process.env.UPSTREAM_IMAGE_NAME === imageMetadata.imageDefinition.herdName && process.env.FEATURE_NAME) {
                                let cleanedName = process.env.FEATURE_NAME.replace(/\//g, '--').toLowerCase();
                                featureDeploymentConfig.isFeatureDeployment = true;
                                featureDeploymentConfig.ttlHours = process.env.FEATURE_TTL_HOURS;
                                featureDeploymentConfig.newName = cleanedName;
                                featureDeploymentConfig.origin = imageMetadata.imageDefinition.herdName + '::' + cleanedName;
                            }

                            if (imageMetadata.imageDefinition.featureDeployment) {
                                featureDeploymentConfig.isFeatureDeployment = true;
                                featureDeploymentConfig.ttlHours = imageMetadata.imageDefinition.timeToLiveHours;
                                featureDeploymentConfig.newName = imageMetadata.imageDefinition.herdName;
                                featureDeploymentConfig.origin = imageMetadata.imageDefinition.herdName + '::feature';
                            }

                            if (featureDeploymentConfig.isFeatureDeployment) {
                                _.forEach(plan.files, function (deploymentFileContent, fileName) {
                                    if (!kubeSupportedExtensions[path.extname(fileName)]) {
                                        // console.debug('Unsupported extension ', path.extname(fileName));
                                        return;
                                    }

                                    if (deploymentFileContent.content) {
                                        let parsedMultiContent = yamlLoad(deploymentFileContent.content);
                                        _.forEach(parsedMultiContent, function (parsedContent) {
                                            if (parsedContent) {
                                                nameReferenceChanges[parsedContent.kind] = nameReferenceChanges[parsedContent.kind] || {};
                                                nameReferenceChanges[parsedContent.kind][parsedContent.metadata.name] = parsedContent.metadata.name + '-' + featureDeploymentConfig.newName;
                                            } else {
                                                console.warn('Parsed content is NULL!!!', deploymentFileContent.content);
                                            }
                                        });
                                    }
                                });
                                featureDeploymentConfig.nameReferenceChanges = nameReferenceChanges;
                            }

                            _.forEach(plan.files, function (deploymentFileContent, fileName) {
                                if (!kubeSupportedExtensions[path.extname(fileName)]) {
                                    // console.debug('Unsupported extension ', path.extname(fileName));
                                    return;
                                }

                                try {
                                    if (deploymentFileContent.content) {
                                        // let deployment = calculateFileDeploymentPlan();
                                        //
                                        // let addDeploymentPromise = releasePlan.addK8sDeployment(deployment);
                                        planPromises.push(calculateFileDeploymentPlan(deploymentFileContent, imageMetadata, fileName, featureDeploymentConfig));

                                    }
                                } catch (e) {
                                    let error = 'When processing ' + fileName + ':\n';
                                    reject(error + e);
                                }
                            });
                            Promise.all(planPromises).then(function (allPlans) {
                                resolve(allPlans);
                            }).catch(function (err) {
                                let message = 'In ' + JSYAML.safeDump(imageMetadata.imageDefinition, 1);
                                message += err;
                                reject(message);
                            });

                        }).catch(function (err) {
                            reject('When processing tar.base64 of docker image ' + JSON.stringify(imageMetadata) + '\n' + err);
                        });
                    }
                } else {
                    reject('No deployment plan found in ' + JSON.stringify(imageMetadata));
                }
            });

        }

    }

    return calculateImagePlan;

};
