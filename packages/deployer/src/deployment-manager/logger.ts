const padleft = require("../padleft")

let initialTime = new Date().getTime()
const timePrefix = "        "

function elapsedTime () {
  return new Date().getTime() - initialTime
}

module.exports = function(consoleInstance) {
  let buildLogger = {
    log: "",
    logStatements: [],
    info() {
      Array.prototype.unshift.call(
        arguments,
        padleft(timePrefix, `${elapsedTime()}`)
      )
      consoleInstance.log.apply(consoleInstance, arguments)
    },
    debug() {
      // Disabled by commenting.
      //            Array.prototype.unshift.call(arguments, 'DEBUG   ');
      //            consoleInstance.log.apply(consoleInstance, arguments);
    },
    error() {
      Array.prototype.unshift.call(arguments, "ERROR   ")
      consoleInstance.log.apply(consoleInstance, arguments)
    },
  }
  return buildLogger
}
