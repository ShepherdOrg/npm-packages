'use strict';

module.exports.myip = async event => {
    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify(
            {
                message: 'I can tell you your IP address now',
                // sourceIp: event.requestContext.identity.sourceIp,
                input: event,
            },
            null,
            2
        ),
    };
};
