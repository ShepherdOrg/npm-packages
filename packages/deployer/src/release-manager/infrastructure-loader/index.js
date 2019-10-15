
const dockerEnvGenerator = require('./docker-env-generator')();
const tmp = require('tmp');
const fs = require('fs');
const parseEnv = require('../../parse-env');
const _ = require('lodash');

module.exports = function (injected) {

    const cmd = injected('exec');
    const logger = injected('logger');

    function calculateInfrastructurePlan(imageMetaData) {
        return new Promise(function (resolve, reject) {
            let herdName = imageMetaData.imageDefinition.herdName;
            let dockerImage = imageMetaData.imageDefinition.image + ':' + imageMetaData.imageDefinition.imagetag;

            let tmpFolder = tmp.dirSync({template: '/tmp/infra-XXXXXX', unsafeCleanup: true});
            let exportedEnv = {};
            let infrastructurePlan = {
                dockerParameters: [],
                origin: herdName
            };

            infrastructurePlan.envMap = dockerEnvGenerator.generateEnvString(process.env);

            let infraEnvMapFile = tmpFolder.name + "/docker-run.env";

            fs.writeFileSync(infraEnvMapFile, infrastructurePlan.envMap);

            infrastructurePlan.dockerParameters.push('run');
            infrastructurePlan.dockerParameters.push('-i');
            infrastructurePlan.dockerParameters.push('--rm');
            infrastructurePlan.dockerParameters.push('-v');
            infrastructurePlan.dockerParameters.push(tmpFolder.name + ":/exports");
            infrastructurePlan.dockerParameters.push("--env-file");
            infrastructurePlan.dockerParameters.push(infraEnvMapFile);
            infrastructurePlan.dockerParameters.push("--network");
            infrastructurePlan.dockerParameters.push("host");
            infrastructurePlan.dockerParameters.push(dockerImage);

            infrastructurePlan.tempFolder = tmpFolder;
            infrastructurePlan.identifier = herdName;

            logger.info('Running infrastructure ' + dockerImage);

            let execOptions = {
                env:process.env,
                stdoutLineHandler:function (stdoutline) {
//                    logStartLimiter && ((logStartLimiter=false) || logger.enterDeployment(dockerImage));
                    logger.info(stdoutline.trim());
                }
            };
            cmd.extendedExec("docker", infrastructurePlan.dockerParameters, execOptions, function (err, code, stdout) {
                    let message = '';
                    message += "Infrastructure run failed " + herdName;
                    message += '\n Output     :' + stdout + '\n';
                    message += ' Error code :' + code + '\n';
                    message += ' Error      :\n';
                    message += err;
                    message += '\n<-';
                    reject(message);
                },
                function (ignored) {
                    try {
                        let parsed = parseEnv.load({
                            path: tmpFolder.name + "/export.env",
                            throwOnOverride: true
                        });
                        if (parsed.error) {
//                        logger.error("When importing values from " + imageDef.name + " - " + dockerImage + ":", parsed.error);
                            let message = ("When importing values from " + imageMetaData.imageDefinition.image + ':' + imageMetaData.imageDefinition.imagetag + ":" + parsed.error);
                            reject(message);
                            return;
                        }

                        _.extend(exportedEnv, parsed);
                        tmpFolder.removeCallback();
                        infrastructurePlan.exportedEnv = exportedEnv;

                        resolve(infrastructurePlan);

                    } catch (e) {
                        reject(e)
                    }
                }

            );
        });
    }

    return calculateInfrastructurePlan;
};
