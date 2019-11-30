import { ILog } from "./index"

export interface ITestLog extends ILog {
  debugEntries: string[]
  infoEntries: string[]
  warnEntries: string[]
}

export function getTestCaseLogger(options: {
  debugOutput: boolean
  infoOutput: boolean
  warnOutput: boolean
}): ITestLog {
  const debugEntries: string[] = []
  const infoEntries: string[] = []
  const warnEntries: string[] = []
  return {
    debugEntries,
    infoEntries,
    warnEntries,
    debug: (_msg: string) => {
      debugEntries.push(_msg)
      options.debugOutput && console.debug("DEBUG " + _msg)
    },
    info: (_msg: string) => {
      infoEntries.push(_msg)
      options.infoOutput && console.info("INFO", _msg)
    },
    warn: (_msg: string) => {
      warnEntries.push(_msg)
      options.warnOutput && console.warn("WARN", _msg)
    },
  }
}
