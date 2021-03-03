import { ILog } from "../logger"

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
  const logStatements: IFakeLogEntry[] = []
  const infoLogEntries: IFakeLogEntry[] = []
  let fakeLogger = {
    log: "",
    logStatements,
    infoLogEntries,
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
    logLevelEntries: (level: TLogLevel): IArguments[] => {
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
