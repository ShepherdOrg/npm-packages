const lambdaLocal = require("lambda-local");
const path = require('path');
const expect = require('chai').expect;

describe('handler', function () {

    describe('regular call handling', function () {

        let executePromise;

        beforeEach(()=>{
            var jsonPayload = require('./sample-events/regular-call');

            executePromise = lambdaLocal.execute({
                event: jsonPayload,
                lambdaPath: path.join(__dirname, 'handler.js'),
                lambdaHandler: 'myip',
                verboseLevel:0 // Disable log output
            })

        });

        it('should return event data to caller as input property on body', () => {
            return executePromise.then(function(result) {
                let body = JSON.parse(result.body);
                expect(body.input.headers).to.be.ok
            })
        });

        it('should return CORS header allowing all origins', () => {
            return executePromise.then(function(result) {
                expect(result.headers['Access-Control-Allow-Origin']).to.equal('*')
            })
        });

        // it('should return clientip in result body', () => {
        //     return executePromise.then(function(result) {
        //         let body = JSON.parse(result.body);
        //         expect(body.sourceIp).to.equal('194.144.63.106')
        //     })
        //
        // });
    });

});
