import {padLeft} from "./padleft"
import { ILog } from "../deployment-types"

let initialTime = new Date().getTime()
const timePrefix = "        "

function elapsedTime () {
  return new Date().getTime() - initialTime
}

export function CreateLogger(consoleInstance:typeof console): ILog {
  let buildLogger: ILog = {
    info() {
      Array.prototype.unshift.call(
        arguments,
        padLeft(timePrefix, `${elapsedTime()}`)
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
    warn() {
      Array.prototype.unshift.call(arguments, "WARN   ")
      consoleInstance.log.apply(consoleInstance, arguments)
    },
  }
  return buildLogger
}
