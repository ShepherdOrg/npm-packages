module.exports={
    dryRunMode: ()=>{return process.env.DRYRUN_MODE === 'true' || false },
    testRunMode: ()=>{return process.env.TESTRUN_MODE === 'true' || false }
};