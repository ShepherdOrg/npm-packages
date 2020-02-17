import { emptyArray } from "../helpers/ts-functions"
import { ILog } from "../deployment-types"

export interface IFakeLogging extends ILog{
  log: string,
  logStatements: Array<IFakeLogEntry>,
  infoLogEntries: Array<IFakeLogEntry>,

  printAllStatements(): void
}

export type IFakeLogEntry = {
  logLevel:string
  data: IArguments
}

export function CreateFakeLogger() : IFakeLogging {
  let fakeLogger = {
    log: "",
    logStatements: emptyArray<IFakeLogEntry>(),
    infoLogEntries: emptyArray<IFakeLogEntry>(),
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
    warn() {
      fakeLogger.log +=
        "warn           " + Array.prototype.join.call(arguments, " ") + "\n"
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
    printAllStatements(): void {
      console.info(fakeLogger.log)
    }
  }
  return fakeLogger
}
