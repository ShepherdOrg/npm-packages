#!/usr/bin/env node
'use strict';
let path = require('path');

/*
This is the main entry point for shepherd deployer agent

Usage: shepherd.js /somewhere/is/a/herd.yaml
 */

global.inject = require('../inject/inject');
global._ = require('lodash');
global.Promise = require('bluebird');

let Logger = require('./logger');

const logger =Logger('shepherd');

console.debug = function () {
    // Array.prototype.unshift.call(arguments, 'SHEPDEBUG ');
    // console.log.apply(console, arguments);
};


const testMode = process.argv.indexOf('testrun-mode') > 0;
let testOutputDir;
if(testMode){
    testOutputDir = process.argv[process.argv.indexOf('testrun-mode') + 1];
    logger.info('Running in test-mode. Writing deployment documents to ' + testOutputDir);
}

let stateStoreBackend;

if(process.env.SHEPHERD_PG_HOST){
    const pgConfig = require('@shepherdorg/postgres-backend').PgConfig();
    const PostgresStore = require('@shepherdorg/postgres-backend').PostgresStore;
    stateStoreBackend = PostgresStore(pgConfig);

} else{
    const FileStore = require('@shepherdorg/filestore-backend').FileStore;
    let homedir = require('os').homedir();
    let shepherdStoreDir = path.join(homedir,'.shepherdstore',process.env.ENV || 'default');
    console.log('Using shepherd store directory ', shepherdStoreDir);
    stateStoreBackend = FileStore({directory: shepherdStoreDir})

}

const ReleaseStateStore = require("@shepherdorg/state-store").ReleaseStateStore;
const HerdLoader = require('./herd-loader');
const ReleasePlanModule = require('./release-plan');
const exec = require('@shepherdorg/exec');


function terminateProcess(exitCode) {
    stateStoreBackend.disconnect();
    process.exit(exitCode);
}

stateStoreBackend.connect().then(function () {

    let releaseStateStore = ReleaseStateStore({storageBackend: stateStoreBackend});


    const ReleasePlan = ReleasePlanModule(inject({
        cmd: exec,
        logger: Logger('execution'),
        stateStore: releaseStateStore
    }));


    let loader = HerdLoader(inject({
        logger: Logger('planning'),
        ReleasePlan: ReleasePlan,
        exec: exec
    }));

    let herdFilePath = process.argv[2];

    logger.info('Shepherding herd from file ' + herdFilePath);
    loader.loadHerd(herdFilePath).then(function (plan) {
        plan.printPlan(logger);
        if(testMode){
            logger.info('Testrun mode set - exporting all deployment documents to ' + testOutputDir);
            logger.info('Testrun mode set - no deployments will be performed');
            plan.exportDeploymentDocuments(testOutputDir).then(function () {
                    terminateProcess(0);
                }
            ).catch(function (writeError) {
                logger.error('Error exporting deployment document! ', writeError);
                terminateProcess(-1);
            })
        } else {
            plan.executePlan().then(function () {
                logger.info('Plan execution complete.');
                terminateProcess(0);
            }).catch(function(err){
                logger.error('Plan execution error', err);
                terminateProcess(-1);
            })
        }
    }).catch(function (loadError) {
        logger.error('Plan load error.', loadError);
        stateStoreBackend.disconnect();
        process.exit(-1);
    });
}).catch(function (err) {
    console.error("Connection/migration error", err);
    process.exit(-1);
});
