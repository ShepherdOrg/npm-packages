module.exports = function() {
  let fakeLogger = {
    log: "",
    logStatements: [],
    infoLogEntries: [],
    info() {
      fakeLogger.log +=
        "info            " + Array.prototype.join.call(arguments, " ") + "\n"
      fakeLogger.logStatements.push({ logLevel: "info", data: arguments })
      fakeLogger.infoLogEntries.push({ logLevel: "info", data: arguments })
    },
    debug() {
      fakeLogger.log +=
        "debug           " + Array.prototype.join.call(arguments, " ") + "\n"
      fakeLogger.logStatements.push({ logLevel: "debug", data: arguments })
    },
    error() {
      fakeLogger.log +=
        "error          " + Array.prototype.join.call(arguments, " ") + "\n"
      fakeLogger.logStatements.push({ logLevel: "error", data: arguments })
    },
    // enterDeployment() {
    //     fakeLogger.log += 'enterDeployment' + Array.prototype.join.call(arguments, ' ') + '\n';
    //     fakeLogger.logStatements.push({logLevel: "enterDeployment", data: arguments})
    // },
    // exitDeployment() {
    //     fakeLogger.log += 'exitDeployment ' + Array.prototype.join.call(arguments, ' ') + '\n';
    //     fakeLogger.logStatements.push({logLevel: "exitDeployment", data: arguments})
    //
    // }
  }
  return fakeLogger
}
