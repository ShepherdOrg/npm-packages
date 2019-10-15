module.exports=function(){
    let fakeExec = {
        executedCommands :[],
        nextResponse: {
            err: undefined,
            success: undefined
        },
        extendedExec: function (command, params, options, err, success) {
            fakeExec.executedCommands.push({
                command: command, params: params, options: options, err: err, success: success
            });
            if(fakeExec.onExec){
                fakeExec.onExec(command, params, options, err, success);
            } else if (fakeExec.nextResponse) {
                if (fakeExec.nextResponse.success) {
                    success(fakeExec.nextResponse.success)
                } else {
                    err(fakeExec.nextResponse.err || 'No execution response defined for ' + JSON.stringify({command, params, options}));
                }
            } else {
                expect().fail('No response defined!!!!')
            }
        }
    };
    return fakeExec
}