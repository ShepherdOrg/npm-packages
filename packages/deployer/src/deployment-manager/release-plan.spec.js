const ReleasePlanModule = require('./release-plan');
const FakeExec = require('../test-tools/fake-exec.js');
const FakeLogger = require('../test-tools/fake-logger.js');

const inject = require('@shepherdorg/nano-inject').inject;
const _ = require('lodash');
const expect = require('chai').expect;

const fs = require('fs');

const k8sDeployments = {
    'ConfigMap_www-icelandair-com-nginx-acls': {
        'herdName': 'image:www-icelandair-com',
        'operation': 'apply',
        'identifier': 'ConfigMap_www-icelandair-com-nginx-acls',
        'descriptor': 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: www-icelandair-com-nginx-acls\n  labels:\n    team: flip\ndata:\n  whitelist: |-\n    ${Base64Decode:WWW_ICELANDAIR_IP_WHITELIST}\n',
        'origin': 'testenvimage:0.0.0:shepherd.kube.config.tar.base64',
        'type': 'k8s'
    },
    'Deployment_www-icelandair-com': {
        'herdName': 'image:www-icelandair-com',
        'operation': 'apply',
        'identifier': 'Deployment_www-icelandair-com',
        'descriptor': 'apiVersion: extensions/v1beta1\nkind: Deployment\nmetadata:\n  name: www-icelandair-com\n  labels:\n    name: www-icelandair-com\n    tier: frontend\nspec:\n  replicas: 2\n  template:\n    metadata:\n      labels:\n        name: www-icelandair-com\n        tier: frontend\n    spec:\n      imagePullSecrets:\n        - name: registry-pull-secret\n      containers:\n        - image: testing123\n          name: www-icelandair-com\n          resources:\n            limits:\n              cpu: 0.8\n              memory: 512M\n            requests:\n              cpu: 25m\n              memory: 256M\n          ports:\n            - containerPort: 81\n              name: http-proxy\n              protocol: TCP\n            - containerPort: 444\n              name: https-proxy\n              protocol: TCP\n          volumeMounts:\n            - name: certs-volume\n              readOnly: true\n              mountPath: /volumes/certs\n            - name: nginx-acls\n              readOnly: true\n              mountPath: /etc/nginx/acls/\n          env:\n            - name: RUNTIME_ENVIRONMENT\n              valueFrom:\n                configMapKeyRef:\n                  name: testing123\n                  key: ENV\n        - image: DOCKER_IMAGE_SSR\n          name: www-icelandair-com-ssr\n          resources:\n            limits:\n              cpu: 0.6\n              memory: 512M\n            requests:\n              cpu: 0.4\n              memory: 256M\n      volumes:\n        - name: certs-volume\n          secret:\n            secretName: star-cert-secret\n        - name: nginx-acls\n          configMap:\n            name: www-icelandair-com-nginx-acls\n            items:\n              - key: whitelist\n                path: whitelist.conf',
        'origin': 'testenvimage:0.0.0:shepherd.kube.config.tar.base64',
        'type': 'k8s'
    },
    'Namespace_monitors': {
        'operation': 'delete',
        'identifier': 'Namespace_monitors',
        'version': 'immutable',
        'descriptor': 'apiVersion: v1\nkind: Namespace\nmetadata:\n  name: monitors\n',
        'herdName': 'folders:namespaces',
        'origin': '/code/lib/deployment-manager/testdata/happypath/namespaces/',
        'type': 'k8s'
    },

};

let dockerDeployers = {
    'testenvimage-migrations:0.0.0': {
        'state': {'new': true, 'modified': true},
        'dockerParameters': [
            '-i',
            '--rm',
            '-e',
            'DB_HOST=testing123',
            '-e',
            'DB_PASS=testing123',
            '-e',
            'DB_HOST=testing123',
            '-e',
            'DB_PASS=testing123',
            '-e',
            'THIS_IS_DEPLOYER_ONE=true',
            'testenvimage-migrations:0.0.0',
            'ls'
        ],
        'origin': 'testenvimage-migrations:0.0.0',
        'type': 'deployer',
        'identifier': 'testenvimage-migrations:0.0.0',
        'herdName': 'testenv-migrations',
        'command': 'ls'
    }
};

describe('Release plan', function () {

    let releasePlan, checkedStates;
    let fakeStateStore;
    let fakeExec;
    let fakeLogger;

    beforeEach(function () {
        checkedStates = [];
        fakeStateStore = {
            nextState: {},
            savedStates: [],
            getDeploymentState: function (deployment) {
                checkedStates.push(JSON.parse(JSON.stringify(deployment)));
                return Promise.resolve(_.extend({
                    testState: true,
                    'new': true,
                    'modified': true,
                    'operation': 'apply',
                    'version': '0.0.0',
                    'lastVersion': undefined,
                    'signature': 'fakesignature',
                    'origin': deployment.origin,
                    'env': 'UNITTEST'
                }, fakeStateStore.nextState));

            },
            saveDeploymentState: function (deploymentState) {
                return new Promise(function (resolve, reject) {
                    if (fakeStateStore.nextState.saveFailure) {
                        reject(fakeStateStore.nextState.message);
                        return;
                    }

                    fakeStateStore.savedStates.push(deploymentState);
                    resolve(deploymentState);
                });

            }
        };
        fakeLogger = FakeLogger();

        fakeExec = FakeExec();
        releasePlan = ReleasePlanModule(inject({
            stateStore: fakeStateStore,
            cmd: fakeExec,
            logger: fakeLogger
        }))('planSpecEnv');
    });

    describe('-k8s- deployment', function () {

        it('should check state for each added kubernetes deployment', function () {
            return releasePlan.addDeployment(k8sDeployments['ConfigMap_www-icelandair-com-nginx-acls']).then(function (deploymentState) {
                expect(deploymentState.state.testState).to.equal(true);
                expect(checkedStates.length).to.equal(1);
                expect(checkedStates[0].env).to.equal('planSpecEnv')
            });
        });

        describe('dry-run', function () {
            beforeEach(function () {

                fakeStateStore.nextState = {'new': false, 'modified': true};
                return releasePlan.addDeployment(k8sDeployments['ConfigMap_www-icelandair-com-nginx-acls']).then(function (deploymentState) {
                    return releasePlan.executePlan({dryRun:true, dryRunOutputDir: '/tmp/'});
                });
            });

            it('should not execute plan ', function () {
                expect(fakeExec.executedCommands.length).to.equal(0);
            });
        });

        describe('unmodified', function () {

            beforeEach(function () {
                fakeStateStore.nextState = {'new': false, 'modified': false};
                return releasePlan.addDeployment(k8sDeployments['ConfigMap_www-icelandair-com-nginx-acls']).then(function (deploymentState) {
                    return releasePlan.executePlan();
                });
            });

            it('should not execute anything and not store state', function () {
                expect(fakeExec.executedCommands.length).to.equal(0);
            });

            it('should print plan stating no changes', function () {
                let outputLogger = new FakeLogger();
                releasePlan.printPlan(outputLogger);
                expect(outputLogger.logStatements.length).to.equal(1);
                expect(outputLogger.logStatements[0].data[0]).to.equal('No modified deployments in image:www-icelandair-com');
            });
        });

        describe('modified deployment docs', function () {
            beforeEach(function () {
                fakeExec.nextResponse.success = 'applied';
                return releasePlan.addDeployment(k8sDeployments['ConfigMap_www-icelandair-com-nginx-acls'])
                    .then(releasePlan.addDeployment(k8sDeployments['Deployment_www-icelandair-com']))
                    .then(releasePlan.addDeployment(k8sDeployments['Namespace_monitors']))
                    .then(function (deploymentState) {
                        return releasePlan.executePlan();
                    });
            });

            it('should execute kubectl apply for all deployments with same origin', function () {
                expect(fakeExec.executedCommands.length).to.equal(3);
                expect(fakeExec.executedCommands[0].command).to.equal('kubectl');
                expect(fakeExec.executedCommands[0].params[0]).to.equal('apply');
                expect(fakeExec.executedCommands[0].params[1]).to.equal('-f');
                expect(fakeExec.executedCommands[0].params[2]).to.equal('-');
                expect(fakeExec.executedCommands[0].options.stdin).to.contain('name: www-icelandair-com-nginx-acls');
            });

            it('should store state kubectl', function () {
                expect(fakeStateStore.savedStates.length).to.equal(3);

                // expect(fakeStateStore.savedStates[0].origin).to.equal(k8sDeployments.Namespace_monitors.origin);
                expect(fakeStateStore.savedStates[0].origin).to.equal(k8sDeployments['ConfigMap_www-icelandair-com-nginx-acls'].origin);
                // expect(fakeStateStore.savedStates[1].origin).to.equal(k8sDeployments["Deployment_www-icelandair-com"].origin);
            });

            it('should log deployments', function () {
                // 3 statements for each deployment
                expect(fakeLogger.logStatements.length).to.equal(9);
            });

            it('should print info about modified deployments', function () {
                let outputLogger = new FakeLogger();
                releasePlan.printPlan(outputLogger);
                expect(outputLogger.logStatements.length).to.equal(5);
                expect(outputLogger.logStatements[0].data[0]).to.equal('From image:www-icelandair-com');
                expect(outputLogger.logStatements[1].data[0]).to.equal('  -  will apply ConfigMap_www-icelandair-com-nginx-acls');
                expect(outputLogger.logStatements[2].data[0]).to.equal('  -  will apply Deployment_www-icelandair-com');
                expect(outputLogger.logStatements[3].data[0]).to.equal('From folders:namespaces');
                expect(outputLogger.logStatements[4].data[0]).to.equal('  -  will delete Namespace_monitors');
            });
        });

        describe('modified, fail to save state', function () {
            let saveError;

            beforeEach(function () {
                fakeStateStore.nextState = {saveFailure: true, message: 'State store failure!'};
                fakeExec.nextResponse.success = 'applied';
                return releasePlan.addDeployment(k8sDeployments['ConfigMap_www-icelandair-com-nginx-acls'])
                    .then(releasePlan.addDeployment(k8sDeployments['Deployment_www-icelandair-com']))
                    .then(releasePlan.addDeployment(k8sDeployments['Namespace_monitors']))
                    .then(function (deploymentState) {
                        return releasePlan.executePlan().catch(function (err) {
                            saveError = err;
                        });
                    });
            });

            it('should propagate error to caller', function () {
                expect(saveError).to.equal('Failed to save state after successful deployment! testenvimage:0.0.0:shepherd.kube.config.tar.base64/ConfigMap_www-icelandair-com-nginx-acls\nState store failure!');
            });
        });

        describe('modified, delete deployment and kubectl responds with not found', function () {
            let saveError,
                executedPlan;

            beforeEach(function () {
                fakeExec.nextResponse.err = 'not found';
                return releasePlan.addDeployment(k8sDeployments['Namespace_monitors'])
                    .then(function (deploymentState) {
                        return releasePlan.executePlan().then(function (executionResults) {
                            executedPlan = executionResults[0];
                        }).catch(function (err) {
                            saveError = err;
                        });
                    });
            });

            it('should not result in error ', function () {
                if (saveError) {
                    console.error(saveError);
                }
                expect(saveError).to.equal(undefined);
            });

            it('should save call log with state', function () {
                expect(executedPlan[0].stdout).to.equal(undefined);
                expect(executedPlan[0].stderr).to.equal('not found');
            });
        });

    });

    describe('- docker deployer -', function () {

        describe('basic state checking', function () {

            let deploymentState;

            beforeEach(function () {
                return releasePlan.addDeployment(dockerDeployers['testenvimage-migrations:0.0.0']).then(function (ds) {
                    deploymentState = ds;
                });

            });

            it('should check state for each added docker deployer', function () {

                expect(deploymentState.state.testState).to.equal(true);
                expect(checkedStates.length).to.equal(1);

            });

            it('should use expanded docker parameter list as deployment descriptor for state checking', function () {
                expect(checkedStates[0].descriptor).to.equal('-i --rm -e DB_HOST=testing123 -e DB_PASS=testing123 -e DB_HOST=testing123 -e DB_PASS=testing123 -e THIS_IS_DEPLOYER_ONE=true testenvimage-migrations:0.0.0');
            });

        });

        describe('modified parameters', function () {

            beforeEach(function () {
                fakeExec.nextResponse.success = 'this would be docker run output';
                fakeStateStore.nextState = {'new': false, 'modified': true};
                return releasePlan.addDeployment(dockerDeployers['testenvimage-migrations:0.0.0']).then(function (deploymentState) {
                    return releasePlan.executePlan();
                });
            });

            it('should run docker with correct parameters', function () {
                let p = 0;
                expect(fakeExec.executedCommands.length).to.equal(1);
                expect(fakeExec.executedCommands[0].command).to.equal('docker');
                expect(fakeExec.executedCommands[0].params[p++]).to.equal('run');
                expect(fakeExec.executedCommands[0].params[p++]).to.equal('-i');
                expect(fakeExec.executedCommands[0].params[p++]).to.equal('--rm');
                expect(fakeExec.executedCommands[0].params[p++]).to.equal('-e');
                expect(fakeExec.executedCommands[0].params[p++]).to.equal('DB_HOST=testing123');
            });

            it('should print info about modified deployments', function () {
                let outputLogger = new FakeLogger();

                releasePlan.printPlan(outputLogger);
                expect(outputLogger.logStatements.length).to.equal(2);
                expect(outputLogger.logStatements[0].data[0]).to.equal('testenv-migrations deployer');
                expect(outputLogger.logStatements[1].data[0]).to.equal('  -  will run testenvimage-migrations:0.0.0 ls');
            });

        });

    });
});

