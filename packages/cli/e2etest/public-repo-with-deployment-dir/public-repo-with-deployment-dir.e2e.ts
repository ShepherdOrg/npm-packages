import {readJsonFiles} from '../src/readJsonFiles'

const exec = require('child-process-promise').exec;
const expect = require('chai').expect
const Future = require('fluture')

describe.only('Build docker with deployment dir', function () {

    this.timeout(10000)
    let shepherdMeta, buildOutput;
    let dockerMeta: any

    before(() => {
        return exec('../bin/shepherd-build-docker.sh public-repo-with-deployment-dir/Dockerfile').then(({stdout, stderr}) => {
            if (stderr) expect.fail('GOT ERROR> ' + stderr)

            buildOutput = stdout

            return Future.promise(readJsonFiles('public-repo-with-deployment-dir/.build', '**/*/shepherd.json')).then((metaFiles) => {
                shepherdMeta = metaFiles[0]

                return exec('docker inspect public-repo-with-deployment-dir:latest').then(({stdout})=>{
                    dockerMeta = JSON.parse(stdout)
                })

            })
        })
    })

    // it('should spew out build output', () => {
    //     console.log('buildOutput', buildOutput)
    // });

    it('should have shepherd.metadata as a label in docker metadata', () => {
        // console.log('dockerMeta[0]', JSON.stringify(dockerMeta[0]))
        expect(dockerMeta[0].Config.Labels['shepherd.metadata'].length).to.equal(684)
    });

    it('should not warn of unconsumed variables', () => {
        expect(buildOutput.indexOf('were not consumed')).to.equal(-1)
    });

    it('should have kubeConfigB64', () => {
        expect(shepherdMeta.kubeConfigB64.length).to.be.gt(1000)
    })

    it('should have correct buildHostName property', () => {
        expect(shepherdMeta.hasOwnProperty('buildHostName')).to.equal(true)
    })

    it('should have correct dockerImageTag property', () => {
        expect(shepherdMeta.dockerImageTag).to.contain('public-repo-with-deployment-dir')
    })

    it('should have correct dockerImageGithash property', () => {
        expect(shepherdMeta.dockerImageGithash).to.contain('public-repo-with-deployment-dir')
    })

    it('should have correct gitUrl property', () => {
        expect(shepherdMeta.gitUrl).to.equal('git@github.com:ShepherdOrg/npm-packages.git')
    })

    it('should have correct gitCommit property', () => {
        expect(shepherdMeta.hasOwnProperty('gitCommit')).to.equal(true)
    })

    it('should have correct lastCommits property', () => {
        expect(shepherdMeta.hasOwnProperty('lastCommits')).to.equal(true)
    })

});
