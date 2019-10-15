const JSYAML = require('js-yaml');

module.exports=function(yamlString){
    let files = yamlString.split('\n---\n');

    let parsedParts = [];
    for (let filec of files) {
        parsedParts.push(JSYAML.safeLoad(filec));
    }
    return parsedParts;
};