import { TStateStoreDependencies} from './index'
import {TDeploymentState} from '@shepherdorg/metadata/dist'

const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const md5File = require('md5-file');
const crypto = require('crypto');


export function DeploymentDir(operation, parameterizedDir) {

    if (!parameterizedDir) {
        throw new Error("Directory parameter is mandatory! ");
    }
    let isADirectory = fs.lstatSync(parameterizedDir).isDirectory();
    if (!isADirectory) {
        throw new Error(parameterizedDir + " is not a directory");
    }

    return {
        signature() {
            let files = fs.readdirSync(parameterizedDir);
            let aggregatedSignatures = "";
            _.each(files, function (file) {
                aggregatedSignatures += md5File.sync(path.join(parameterizedDir, file));
            });

            return crypto.createHash('md5').update(operation + aggregatedSignatures).digest("hex");
        }
    }
}


export function ReleaseStateStore(injected: TStateStoreDependencies) {
    let storageBackend = injected.storageBackend;

    function getStateSignature(env, deploymentIdentifier, operation, deploymentVersion, newSignature) {
        return new Promise(function (resolve, reject) {
            try {
                let envIdentifier = env + "-" + deploymentIdentifier;
                storageBackend.get(envIdentifier).then(function (keyValue) {
                    let existingState = keyValue.value;
                    let newState: TDeploymentState = {
                        "key": envIdentifier,
                        "new": true,
                        "modified": true,
                        "operation": operation,
                        "version": deploymentVersion,
                        "lastVersion": undefined,
                        "signature": newSignature,
                        "env": env
                    };
                    if (existingState) {
                        newState.new = false;
                        newState.lastVersion = existingState.version;
                        newState.modified = operation !== existingState.operation
                            || existingState.signature !== newSignature
                            || existingState.version !== deploymentVersion;
                    }

                    resolve(newState);

                }, function (err) {
                    reject(err);
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    function saveDeploymentState(stateSignatureObject) {
        return new Promise(function (resolve, reject) {
            if (stateSignatureObject.modified) {

                let timestampedObject = _.extend({timestamp: new Date().toISOString()}, stateSignatureObject);
                storageBackend.set(stateSignatureObject.key, timestampedObject).then(function (storedValueKeyPair) {
                    resolve(storedValueKeyPair.value);
                }, function (err) {
                    reject(err);
                });
            } else {
                resolve(stateSignatureObject);
            }

        })
    }

    return {
        getDeploymentState: function (deployment) {
            let deploymentSignature = crypto.createHash('md5').update(deployment.operation + deployment.descriptor).digest("hex");
            return getStateSignature(deployment.env, deployment.identifier, deployment.operation, deployment.version, deploymentSignature);
        },
        saveDeploymentState: saveDeploymentState,
        storeDeploymentDirState: function (deployment) {
            let deploymentSignature = DeploymentDir(deployment.operation, deployment.directory).signature();
            return getStateSignature(deployment.env, deployment.identifier, deployment.operation, deployment.version, deploymentSignature)
                .then(saveDeploymentState);
        }
    }
}
