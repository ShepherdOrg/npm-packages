const fs = require('fs');
const path = require('path');
const YAML = require('js-yaml');
const _ = require('lodash');
const inject = require('@shepherdorg/nano-inject').inject;

const Promise = require('bluebird').Promise;

const kubeSupportedExtensions = require('./kubeSupportedExtensions');

const calculateDeploymentPlan = require('./image-deployment-planner')(inject({
    kubeSupportedExtensions
}));

const addShepherdMetadata = require('./add-shepherd-metadata');

function splitDockerImageTag (imgObj) {
    let colonIdx = imgObj.dockerImage.indexOf(':');
    imgObj.image = imgObj.dockerImage.slice(0, colonIdx);
    imgObj.imagetag = imgObj.dockerImage.slice(colonIdx + 1, imgObj.dockerImage.length);
}

module.exports = function (injected) {

    const ReleasePlan = injected('ReleasePlan');

    const labelsLoader = injected('labelsLoader', true) || require('@shepherdorg/docker-image-metadata-loader');


    const scanDir = require('./folder-deployment-planner')(inject({
        kubeSupportedExtensions: {
            '.yml': true,
            '.yaml': true,
            '.json': true
        }
    }));

    const logger = injected('logger');

    // const cmd = injected('exec');

    const dockerRegistries = labelsLoader.getDockerRegistryClientsFromConfig();
    const loader = labelsLoader.imageLabelsLoader(inject({'dockerRegistries': dockerRegistries, logger: logger}));

    function calculateFoldersPlan (imagesPath, herdFolder) {
        return scanDir(path.resolve(imagesPath + '/' + herdFolder.path));
    }

    function loadImageMetadata (imageDef) {
        return loader.getImageLabels(imageDef);
    }

    return {
        loadHerd (fileName) {
            return new Promise(function (resolve, reject) {
                try {
                    if (fs.existsSync(fileName)) {
                        let releasePlan = ReleasePlan();

                        let infrastructurePromises = [];
                        let allDeploymentPromises = [];
                        const imagesPath = path.dirname(fileName);

                        let herd = YAML.load(fs.readFileSync(fileName, 'utf8'));

                        let imageDependencies = {};

                        function frontloadMigrationRunners (imageMetaData) {
                            return new Promise(function (resolve, reject) {
                                let dependency;
                                if (imageMetaData.dockerLabels['shepherd.dbmigration']) {
                                    logger.debug('add dependencies from shepherd.dbmigration ', imageMetaData.dockerLabels['shepherd.dbmigration']);
                                    dependency = imageMetaData.dockerLabels['shepherd.dbmigration'];
                                }
                                if (dependency) {
                                    imageDependencies[dependency] = {
                                        dockerImage: dependency
                                    };
                                }

                                resolve(imageMetaData);
                            });
                        }

                        let infrastructureLoader = function (infrastructureImages) {
                            return new Promise(function (resolve) {
                                resolve(_.map(infrastructureImages, function (herdDefinition, herdName) {
                                    herdDefinition.herdName = herdName;
                                    return loadImageMetadata(herdDefinition)
                                        .then(calculateDeploymentPlan)
                                        .catch(function (e) {
                                            reject( new Error('When processing ' + herdName + ': ' + e + (e.stack ? e.stack : '')));
                                        });
                                }));

                            });

                        };

                        infrastructurePromises.push(infrastructureLoader(herd.infrastructure || {})
                            .then(function (addedPromises) {
                                return Promise.all(addedPromises).catch(reject);
                            }).catch(reject));

                        let loaders = {
                            folders: function (folders) {
                                return new Promise(function (resolve) {
                                    resolve(_.map(folders, function (herdFolder, herdFolderName) {
                                        herdFolder.herdName = herdFolderName;

                                        return calculateFoldersPlan(imagesPath, herdFolder).then(function (plans) {
                                            return Promise.each(plans, function (deploymentPlan) {
                                                deploymentPlan.herdName = `${herdFolder.herdName} - ${deploymentPlan.origin}`;
                                                return releasePlan.addDeployment(deploymentPlan);
                                            });
                                        }).catch(function (e) {
                                            reject('When processing folder ' + herdFolderName + '\n' + e + (e.stack ? e.stack : ''));
                                        });
                                    }));

                                });

                            },
                            images: function (images) {
                                return new Promise(function (resolve) {
                                    resolve(_.map(images, function (imgObj, imgName) {
                                        imgObj.herdName = imgName;
                                        logger.debug('Deployment image - loading image meta data for docker image', JSON.stringify(imgObj));

                                        if (!imgObj.image && imgObj.dockerImage) {
                                            splitDockerImageTag(imgObj);
                                        }
                                        return loadImageMetadata(imgObj)
                                            .then(addShepherdMetadata)
                                            .then(frontloadMigrationRunners)
                                            .then(calculateDeploymentPlan)
                                            .then(function (imagePlans) {
                                                return Promise.each(imagePlans, releasePlan.addDeployment);
                                            }).then(function (imgPlans) {
                                                return imgPlans;
                                            }).catch(function (e) {
                                                let errorMessage = 'When processing image ' + imgName + '\n' + e.message + (e.stack ? e.stack : '');
                                                reject(new Error(errorMessage));
                                            });
                                    }));

                                });

                            }
                        };

                        Promise.resolve({}).then(function () {

                            _.each(herd, function (herderDefinition, herdType) {
                                if (loaders[herdType]) {

                                    allDeploymentPromises.push(loaders[herdType](herderDefinition)
                                        .then(function (addedPromises) {
                                            return Promise.all(addedPromises).catch(function (e) {
                                                reject(e);
                                            });
                                        }).catch(reject));
                                }
                            });

                            Promise.all(allDeploymentPromises).then(function () {
                                return loaders.images(imageDependencies).then(function (planPromises) {
                                    return Promise.all(planPromises).catch(function (e) {
                                        reject(e);
                                    });
                                }).catch(function (e) {
                                    reject(e);
                                });
                            }).then(function () {
                                resolve(releasePlan);
                            }).catch(reject);

                        });

                    } else {
                        reject(fileName + ' does not exist!');
                    }
                } catch
                    (e) {
                    reject(e);
                }
            });

        }
    };
};
