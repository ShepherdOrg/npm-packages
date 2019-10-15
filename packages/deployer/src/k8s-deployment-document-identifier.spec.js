const fs = require('fs');

const identifier = require('./k8s-deployment-document-identifier');

describe('k8s deployment document identifier', function () {
    it('should be ok with multipart document using LF separator', function () {
        let rawYamlDoc = fs.readFileSync(__dirname + '/testdata/multipart-deployment.yaml', {encoding: 'UTF-8'});

        let fileIdentity = identifier(rawYamlDoc);

        console.log('fileIdentity', fileIdentity);
    });

});