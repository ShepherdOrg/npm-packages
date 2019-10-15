
const JSYAML = require('js-yaml');
const YAMLload = require('./multipart-yaml-load');


function modifyRawDocument(filecontents, options) {

    function addTimeToLive(deploymentDoc) {
        if (!deploymentDoc.metadata) {
            deploymentDoc.metadata = {};
        }
        if (!deploymentDoc.metadata.labels) {
            deploymentDoc.metadata.labels = {};
        }
        deploymentDoc.metadata.labels["ttl-hours"] = `${options.ttlHours}`;
    }

    function adjustNames(deploymentDoc) {

        deploymentDoc.name && (deploymentDoc.name += "-" + options.newName);

        if (deploymentDoc.metadata ) {
            deploymentDoc.metadata.name && ( deploymentDoc.metadata.name += "-" + options.newName );
            if( deploymentDoc.metadata.labels){
                if(deploymentDoc.metadata.labels.name) {
                    deploymentDoc.metadata.labels.name += "-" +options.newName;
                }
                if (deploymentDoc.metadata.labels.topdomain) {
                    delete deploymentDoc.metadata.labels.topdomain;
                }
                if (deploymentDoc.metadata.labels.subdomain) {
                    deploymentDoc.metadata.labels.subdomain =  options.newName;
                }
            }
        }
        if (deploymentDoc.spec){
            if( deploymentDoc.spec.template) {
                let template = deploymentDoc.spec.template;
                if(template.metadata && template.metadata.labels && template.metadata.labels.name){
                    template.metadata.labels.name += "-" +options.newName;
                }

                if(template.spec.containers){
                    for(let container of template.spec.containers){
                        container.name += "-" +options.newName;
                    }
                }

                if(template.spec.volumes){
                    for(let volume of template.spec.volumes){
                        if(volume.configMap && volume.configMap.name && volume.configMap.name === options.configMapName){
                            volume.configMap.name += "-" + options.newName;
                        }
                        if(volume.configMap && volume.configMap.name && options.nameReferenceChanges['ConfigMap']  && options.nameReferenceChanges['ConfigMap'][volume.configMap.name] ){
                            volume.configMap.name = options.nameReferenceChanges['ConfigMap'][volume.configMap.name];
                        }
                    }
                }
            }
            if( deploymentDoc.spec.selector) {
                deploymentDoc.spec.selector.name += "-" +options.newName;
            }
            if(deploymentDoc.kind==="HorizontalPodAutoscaler"){
                deploymentDoc.spec.minReplicas=1;
                deploymentDoc.spec.maxReplicas=1;
                if( deploymentDoc.spec.scaleTargetRef && deploymentDoc.spec.scaleTargetRef.name ){
                    deploymentDoc.spec.scaleTargetRef.name += "-" +options.newName;
                }

            }
        }
    }

    function setOneReplica(deploymentDoc){
        if (deploymentDoc.spec && deploymentDoc.spec.replicas) {
            deploymentDoc.spec.replicas = 1;
        }
    }

    let yamlFiles = YAMLload(filecontents);


    let outfiles = "";
    for (let parsedDocument of yamlFiles) {

        addTimeToLive(parsedDocument);

        adjustNames(parsedDocument);

        setOneReplica(parsedDocument);

        let yml = JSYAML.safeDump(parsedDocument);
        if (outfiles.length > 0) {
            outfiles += "\n---\n"
        }
        outfiles += yml.trim()
    }
    return outfiles;
}

module.exports = {
    modifyRawDocument:modifyRawDocument

};