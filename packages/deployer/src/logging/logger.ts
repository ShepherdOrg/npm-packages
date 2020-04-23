import * as chalk from "chalk"

import 'array-flat-polyfill'

let initialTime = new Date().getTime()

function elapsedTime() {
  return new Date().getTime() - initialTime
}

export type TLoggerOptions = { maxWidth?: number; defaultContext?: TLogContext }

const defaultOptions: TLoggerOptions = { maxWidth: Number.MAX_VALUE }

export const LOG_CONTEXT_PREFIX_PADDING = "            "

export type TLogContext = { prefix?: string; color?: chalk.ChalkFunction; performanceLog?: boolean }

export type FLogFunction = (logLine: string, logContext?: TLogContext) => void

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
  logString
    .toString()
    .split("\n")
    .map(chunkSubstr(logLineLength))
    .flat(1)
    .map(prefixWithContext)
    .forEach((prefixedLine: string) => consoleInstance.log(prefixedLine))
}

function renderLogStringWithColoredPrefix(
  options: TLoggerOptions,
  prefixWithContext: (logLine: string) => string,
  logPrefixColor: chalk.ChalkFunction | undefined,
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
      //            Array.prototype.unshift.call(arguments, 'DEBUG   ');
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
