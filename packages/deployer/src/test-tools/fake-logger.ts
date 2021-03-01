import { emptyArray } from "../helpers/ts-functions"
import { ILog } from "../logging/logger"

export interface IFakeLogging extends ILog {
  log: string
  logStatements: Array<IFakeLogEntry>
  infoLogEntries: Array<IFakeLogEntry>

  logLevelEntries: (level: TLogLevel) => Array<IArguments>
  printAllStatements(): void
}

export type TLogLevel = "debug" | "info" | "warn" | "error" | "fatal"
export type IFakeLogEntry = {
  logLevel: TLogLevel
  data: IArguments
}

export function createFakeLogger(): IFakeLogging {
  let fakeLogger = {
    log: "",
    logStatements: emptyArray<IFakeLogEntry>(),
    infoLogEntries: emptyArray<IFakeLogEntry>(),
    info() {
      fakeLogger.log += "info            " + Array.prototype.join.call(arguments, " ") + "\n"
      fakeLogger.logStatements.push({ logLevel: "info", data: arguments })
      fakeLogger.infoLogEntries.push({ logLevel: "info", data: arguments })
    },
    debug() {
      fakeLogger.log += "debug           " + Array.prototype.join.call(arguments, " ") + "\n"
      fakeLogger.logStatements.push({ logLevel: "debug", data: arguments })
    },
    warn() {
      fakeLogger.log += "warn           " + Array.prototype.join.call(arguments, " ") + "\n"
      fakeLogger.logStatements.push({ logLevel: "warn", data: arguments })
    },
    error() {
      fakeLogger.log += "error          " + Array.prototype.join.call(arguments, " ") + "\n"
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
    logLevelEntries: (level: TLogLevel) => {
      return fakeLogger.logStatements
        .filter(le => {
          return le.logLevel === level
        })
        .map(le => {
          return le.data
        })
    },
    printAllStatements(): void {
      console.info(fakeLogger.log)
    },
  }
  return fakeLogger
}
