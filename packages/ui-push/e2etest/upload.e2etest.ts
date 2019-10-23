import { expect } from "chai";

import {CreatePushApi} from './upload'
import {THerdDeployerMetadata} from '../src/temptypes'
import {getValidHerdDeployerMetadata} from '../src/testdata'


describe('Push to UI', function () {

    it('should have required variables in environment to conduct test', () => {
        expect(process.env.SHEPHERD_UI_API_KEY).not.to.equal(undefined)
        expect(process.env.SHEPHERD_UI_GQL_ENDPOINT).not.to.equal(undefined)
    });

    it('should push deployment to UI', () => {
        const deploymentInfo:THerdDeployerMetadata = getValidHerdDeployerMetadata()


        const pushApi = CreatePushApi(process.env.SHEPHERD_UI_GQL_ENDPOINT, process.env.SHEPHERD_UI_API_KEY)

        pushApi.pushDeploymentStateToUI()

    });

});
