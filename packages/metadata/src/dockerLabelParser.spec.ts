import {TShepherdDeployerMetadata, TShepherdK8sMetadata} from './index'
import {extractImageLabels, extractMetadataFromDockerInspectJson, extractShepherdMetadata} from './dockerLabelParser'

const expect = require('chai').expect


describe('Shepherd metadata reading', function () {

    describe('from image with no shepherd labels', function () {
        let metaData: TShepherdK8sMetadata

        let loadError: Error

        before(async () => {
            try {
                metaData = await extractMetadataFromDockerInspectJson('./testdata/inspected-dockers/alpine.json')
                console.log('Loaded metadata', metaData)
            } catch (err) {
                loadError = err
            }
        })

        it('should throw an error', () => {
            expect(loadError.message).to.contain('No shepherd labels present in docker image Labels {}')
        });
    });

    describe('from shepherd.metadata label, k8s deployment', function () {

        let metaData: TShepherdK8sMetadata

        before(async () => {
            metaData = await extractMetadataFromDockerInspectJson('./testdata/inspected-dockers/public-repo-with-deployment-dir.json')
        })

        it('should contain buildHostName', () => {
            // noinspection BadExpressionStatementJS
            expect(metaData.buildHostName).to.be.ok;
        });

        it('should contain dockerImageTag', () => {
            expect(metaData.dockerImageTag).to.be.a('string')
        });

        // it('should contain gitHash', () => {
        //     expect(metaData.gitHash).to.be.a('string')
        // });

        it('should contain gitUrl', () => {
            expect(metaData.gitUrl).to.equal('git@github.com:ShepherdOrg/npm-packages.git')
        });

        it('should contain gitCommit', () => {
            expect(metaData.gitCommit).to.be.a('string')
        });

        it('should contain lastCommits', () => {
            expect(metaData.lastCommits).to.be.a('string')
        });

        it('should contain kubeConfigB64', () => {
            expect(metaData.kubeConfigB64).to.be.a('string')
        });

        it('should uncompress string in kubeConfigB64', () => {
            expect(metaData.kubeDeploymentFiles['./deployment/kube.yaml'].content).to.be.a('string')
        });

        it('should read hyperlinks', () => {

        });

    });


    describe('from docker labels, k8s deployment, old style', function () {

        let metaData: TShepherdK8sMetadata

        before(async () => {
            const dockerImageInspection = require('./testdata/inspected-dockers/testenvimage.json')
            const imageLabels = extractImageLabels(dockerImageInspection)
            metaData = await extractShepherdMetadata(imageLabels)
        })

        it('should read shepherd.dbmigration', () => {
            expect(metaData.dbMigrationImage).to.equal('testenvimage-migrations:0.0.0')
        });

        it('should read shepherd.kube.config.tar.base64', () => {
            expect(metaData.kubeConfigB64).to.be.a('string')
        });

        it('should read shepherd.deployer', () => {
            expect(metaData.isDeployer).to.equal(false)
        });

        it('should decode shepherd.lastcommits', () => {
            expect(metaData.lastCommits).to.include('Rewrite labels in metadata rather than using or statements')
        });

        it('should read shepherd.name', () => {
            expect(metaData.displayName).to.equal('Testimage')
        });

    });


    describe('from docker labels, deployer, old style', function () {

        let metaData: TShepherdDeployerMetadata

        before(async () => {
            const dockerImageInspection = require('./testdata/inspected-dockers/testenvimage-migrations.json')
            const imageLabels = extractImageLabels(dockerImageInspection)
            metaData = await extractShepherdMetadata(imageLabels) as TShepherdDeployerMetadata
        })

        it('should read shepherd.deployer.command', () => {
            expect(metaData.deployCommand).to.equal('ls')
        });

        it('should read shepherd.rollback.command', () => {
            expect(metaData.rollbackCommand).to.equal('cat')
        });

        it('should read environment variables expansion string', () => {
            expect(metaData.environmentVariablesExpansionString).to.contain('MICROSERVICES_POSTGRES_RDS_HOST')
        });

    })

});


describe('Shepherd metadata creation', function () {


    describe('from process.env with everything available', function () {

        it('should output json with all required variables', () => {

        });
    });


    describe('from process.env with missing env variables', function () {

        it('should complain about all missing variables', () => {

        });
    });

})
