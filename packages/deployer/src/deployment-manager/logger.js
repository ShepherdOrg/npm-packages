const Stopwatch = require('timer-stopwatch');
let globalwatch;
if(!globalwatch){
    globalwatch = new Stopwatch();
    globalwatch.start();
}

const padleft = require('../padleft');
const timePrefix = '         ';

module.exports=function(consoleInstance){
    let buildLogger = {
        log:'',
        logStatements: [],
        info() {
            Array.prototype.unshift.call(arguments, padleft(timePrefix, `${globalwatch.ms}`));
            consoleInstance.log.apply(consoleInstance, arguments);
        },
        debug() {
//            Array.prototype.unshift.call(arguments, 'DEBUG   ');
//            consoleInstance.log.apply(consoleInstance, arguments);
        },
        error() {
            Array.prototype.unshift.call(arguments, 'ERROR   ');
            consoleInstance.log.apply(consoleInstance, arguments);
        }
    };
    return buildLogger
};

