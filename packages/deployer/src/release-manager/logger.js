const Stopwatch = require('timer-stopwatch');
let globalwatch;
if(!globalwatch){
    globalwatch = new Stopwatch();
    globalwatch.start();
}

const padleft = require('../padleft');
const timePrefix = '         ';

module.exports=function(){
    let buildLogger = {
        log:'',
        logStatements: [],
        info() {
            Array.prototype.unshift.call(arguments, padleft(timePrefix, `${globalwatch.ms}`));
            console.log.apply(console, arguments);

        },
        debug() {
//            Array.prototype.unshift.call(arguments, 'DEBUG   ');
//            console.log.apply(console, arguments);
        },
        error() {
            Array.prototype.unshift.call(arguments, 'ERROR   ');
            console.log.apply(console, arguments);
        }
    };
    return buildLogger
};;

