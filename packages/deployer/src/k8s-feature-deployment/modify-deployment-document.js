const JSYAML = require('js-yaml');
const YAMLload = require('./multipart-yaml-load');
const _ = require('lodash');

// const path = require('path');

function modifyRawDocument (filecontents, options) {

    let cleanedName = options.newName.replace(/\//g, '-').toLowerCase();

    if (!Boolean(cleanedName)) {
        throw new Error('Must provide a feature name for document modifications');
    }

    options.nameChangeIndex = options.nameChangeIndex || {};

    function addTimeToLive (deploymentDoc) {
        if (!deploymentDoc.metadata) {
            deploymentDoc.metadata = {};
        }
        if (!deploymentDoc.metadata.labels) {
            deploymentDoc.metadata.labels = {};
        }
        if (!options.ttlHours) {
            throw new Error('ttlHours is a required parameter!');
        }
        deploymentDoc.metadata.labels['ttl-hours'] = `${options.ttlHours}`;
    }

    function adjustNames (deploymentSection) {

        deploymentSection.name && (deploymentSection.name += '-' + cleanedName);

        if (deploymentSection.metadata) {
            deploymentSection.metadata.name && (deploymentSection.metadata.name += '-' + cleanedName);
            if (deploymentSection.metadata.labels) {
                if (deploymentSection.metadata.labels.app) {
                    deploymentSection.metadata.labels.app += '-' + cleanedName;
                }
                if (deploymentSection.metadata.labels.name) {
                    deploymentSection.metadata.labels.name += '-' + cleanedName;
                }
            }
        }
        if (deploymentSection.spec) {
            if (deploymentSection.spec.containers) {
                for (let container of deploymentSection.spec.containers) {
                    adjustNames(container);
                }
            }

            let template = deploymentSection.spec.template;
            if (template) {
                adjustNames(deploymentSection.spec.template);

                if (template.spec.volumes) {
                    for (let volume of template.spec.volumes) {
                        if (volume.configMap && volume.configMap.name && volume.configMap.name === options.configMapName) {
                            volume.configMap.name += '-' + cleanedName;
                        }
                        if (volume.configMap && volume.configMap.name && options.nameChangeIndex['ConfigMap'] && options.nameChangeIndex['ConfigMap'][volume.configMap.name]) {
                            volume.configMap.name = options.nameChangeIndex['ConfigMap'][volume.configMap.name];
                        }
                    }
                }
            }
            if (deploymentSection.spec.selector) {
                adjustNames(deploymentSection.spec.selector);
                if (Boolean(deploymentSection.spec.selector.app)) {
                    deploymentSection.spec.selector.app += '-' + cleanedName;
                }
            }

            if (deploymentSection.kind === 'HorizontalPodAutoscaler') {
                deploymentSection.spec.minReplicas = 1;
                deploymentSection.spec.maxReplicas = 1;
                if (deploymentSection.spec.scaleTargetRef && deploymentSection.spec.scaleTargetRef.name) {
                    deploymentSection.spec.scaleTargetRef.name += '-' + cleanedName;
                }

            }
        }
    }

    function adjustIngressNames (deploymentDoc) {

        if (deploymentDoc.kind && deploymentDoc.kind === 'Ingress' && deploymentDoc.spec) {
            if (deploymentDoc.spec.rules && deploymentDoc.spec.rules[0] && deploymentDoc.spec.rules[0].host) {
                deploymentDoc.spec.rules[0].host = `${cleanedName}-${deploymentDoc.spec.rules[0].host}`;
                const http = deploymentDoc.spec.rules[0].http;
                if (http && http.paths)
                    _.each(http.paths, (path) => {
                        if (path && path.backend && path.backend.serviceName) {
                            path.backend.serviceName = cleanedName + '-' + path.backend.serviceName;
                        }
                    });

            }
        }
    }

    function setOneReplica (deploymentDoc) {
        if (deploymentDoc.spec && deploymentDoc.spec.replicas) {
            deploymentDoc.spec.replicas = 1;
        }
    }

    let yamlFiles = YAMLload(filecontents);

    let outfiles = '';
    for (let parsedDocument of yamlFiles) {

        addTimeToLive(parsedDocument);

        adjustNames(parsedDocument);

        setOneReplica(parsedDocument);

        adjustIngressNames(parsedDocument);

        try {
            let yml = JSYAML.safeDump(parsedDocument);
            if (outfiles.length > 0) {
                outfiles += '\n---\n';
            }
            outfiles += yml.trim();

        } catch (err) {

            console.error('Error dumping', parsedDocument);
            throw err;
        }

    }
    return outfiles;
}

module.exports = {
    modifyRawDocument: modifyRawDocument

};
