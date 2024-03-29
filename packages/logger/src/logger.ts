import * as chalk from "chalk"
import { Chalk } from "chalk"

import "array-flat-polyfill"

let initialTime = new Date().getTime()

function elapsedTime() {
  return new Date().getTime() - initialTime
}

export type TLoggerOptions = { maxWidth?: number; defaultContext?: TLogContext }

const defaultOptions: TLoggerOptions = { maxWidth: Number.MAX_VALUE }

export const LOG_CONTEXT_PREFIX_PADDING = "            "

export type TLogContext = { prefix?: string; color?: Chalk; performanceLog?: boolean }

export type FLogFunction = (logLine: string | null | undefined, logContext?: TLogContext) => void

export type ILog = {
  info: FLogFunction
  debug: FLogFunction
  warn: FLogFunction
  error: (logLine: string, error?: Error, logContext?: TLogContext) => void
}

let DEFAULT_LOG_CONTEXT: TLogContext = {
  color: chalk.white,
  prefix: "",
  performanceLog: false,
}

const chunkSubstr = (logLineLength: number) => (str: string): string[] => {
  const numChunks = Math.ceil(str.length / logLineLength)
  const chunks = new Array(numChunks)

  for (let i = 0, o = 0; i < numChunks; ++i, o += logLineLength) {
    chunks[i] = str.substr(o, logLineLength)
  }

  return chunks
}

function formatLogWithPrefix(
  logString: string,
  logLineLength: number,
  prefixWithContext: (logLine: string) => string,
  consoleInstance: any
) {
  if (logString === undefined || logString === null) {
    return consoleInstance.log(prefixWithContext("undefined or null string in output!"))
  }

  try {
    logString
      .toString()
      .split("\n")
      .map(chunkSubstr(logLineLength))
      .flat(1)
      .map(prefixWithContext)
      .forEach((prefixedLine: string) => consoleInstance.log(prefixedLine))
  } catch (err) {
    consoleInstance.log(
      "Log formatter encountered an error while formatting a string for output! String follows unformatted, followed by the error."
    )
    consoleInstance.log(logString)
    consoleInstance.log(err)
  }
}

function renderLogStringWithColoredPrefix(
  options: TLoggerOptions,
  prefixWithContext: (logLine: string) => string,
  logPrefixColor: Chalk | undefined,
  logString: string,
  consoleInstance: any,
  prefix: string,
  contextSeparator = `|`
) {
  let prefixString = `${prefix} ${contextSeparator}`
  let logLineLength = Number.MAX_VALUE
  if (options.maxWidth !== Number.MAX_VALUE && prefix) {
    logLineLength = (options.maxWidth || Number.MAX_VALUE) - (prefixString.length + 1)
  }

  prefixWithContext = (logLine: string) =>
    `${(logPrefixColor && logPrefixColor(prefixString)) || prefixString} ${logLine}`
  formatLogWithPrefix(logString, logLineLength, prefixWithContext, consoleInstance)
  return prefixWithContext
}

export function createLogger(consoleInstance: typeof console, options: TLoggerOptions = defaultOptions): ILog {
  // let prefixColor = options.color || chalk.white
  // const prefixError = (errorLine: string) => `${chalk.red(prefixString)} ${errorLine}`

  let buildLogger: ILog = {
    info(logString: string, logContext: TLogContext = options.defaultContext || DEFAULT_LOG_CONTEXT) {
      let prefixWithContext = (logLine: string) => `${logLine}`

      if (logContext.prefix) {
        let logPrefixColor = logContext.color
        prefixWithContext = renderLogStringWithColoredPrefix(
          options,
          prefixWithContext,
          logPrefixColor,
          logString,
          consoleInstance,
          logContext.prefix
        )
      } else {
        consoleInstance.log(logString)
      }
      if (logContext.performanceLog) {
        consoleInstance.log(prefixWithContext(chalk.gray(`${elapsedTime()}ms elapsed`)))
      }
    },
    debug() {
      // Disabled by commenting.
      //            Array.prototype.unshift.call(arguments, 'debug   ');
      //            consoleInstance.log.apply(consoleInstance, arguments);
    },
    error(logString: string, error?: Error, logContext: TLogContext = options.defaultContext || DEFAULT_LOG_CONTEXT) {
      let prefixWithContext = (logLine: string) => `${logLine}`

      if (logContext.prefix) {
        let logPrefixColor = chalk.bgRed
        renderLogStringWithColoredPrefix(
          options,
          prefixWithContext,
          logPrefixColor,
          logString,
          consoleInstance,
          logContext.prefix,
          "E"
        )
      } else {
        consoleInstance.log(logString)
      }
    },
    warn(logString: string, logContext: TLogContext = options.defaultContext || DEFAULT_LOG_CONTEXT) {
      let prefixWithContext = (logLine: string) => `${logLine}`

      if (logContext.prefix) {
        let logPrefixColor = chalk.rgb(255, 112, 0) // orange

        renderLogStringWithColoredPrefix(
          options,
          prefixWithContext,
          logPrefixColor,
          logString,
          consoleInstance,
          logContext.prefix,
          "W"
        )
      } else {
        consoleInstance.log(logString)
      }
    },
  }
  return buildLogger
}
