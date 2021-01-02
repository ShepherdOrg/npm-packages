const fetch = require('node-fetch').default;
const expect = require('chai').expect;
const execa = require('execa');

describe('env requirements', () => {

    it('should have process.env.WEB_API_STACK_NAME defined in environment', () => {
        expect(process.env.WEB_API_STACK_NAME).to.be.ok;
    });
});

describe('my ip end to end', () => {

    const webApiStackName = process.env.WEB_API_STACK_NAME || 'myip-master';

    let fetchPromise;

    before(() => {

        return execa(`aws`, ['cloudformation', 'describe-stacks', '--region', 'eu-west-1', '--stack-name', webApiStackName, '--output', 'json']).then((output) => {

            let stackDescription = JSON.parse(output.stdout);

            var apiGatewayInvokeURLValue = stackDescription.Stacks[0].Outputs.filter(function (stackOutput) {return (stackOutput.OutputKey === 'apiGatewayInvokeURL');}).pop();

            const apiUrl = apiGatewayInvokeURLValue.OutputValue;

            fetchPromise = fetch(apiUrl, {
                method: 'POST',
                mode: 'cors',
                redirect: 'follow'
            }).then((response) => {
                return response.json();
            });
        });

    });

    it('should fetch myIp from deployed lambda', () => {
        return fetchPromise.then((resJson) => {
            return expect(resJson.input.requestContext.identity.sourceIp.match(/\d+\.\d+\.\d+\.\d/).length).to.equal(1);
        });

    });
}).timeout(10000);

