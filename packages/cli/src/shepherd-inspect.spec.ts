import {expect} from 'chai';
import {TShepherdK8sMetadata} from '@shepherdorg/metadata/dist'
import {inspectAndExtractShepherdMetadata} from './shepherd-inspect'

describe('shepherd inspect', function () {

    it('should inspect public-repo-with-kube-yaml image with shepherd.metadata label', () => {

        return inspectAndExtractShepherdMetadata('public-repo-with-kube-yaml:latest').then( function () {
            return (shepherdLabels: TShepherdK8sMetadata) => {
                expect(shepherdLabels.dockerImageTag).to.equal('public-repo-with-kube-yaml:latest')
                expect(shepherdLabels.kubeDeploymentFiles).to.be.an('object')
            }
        })

    });
});
