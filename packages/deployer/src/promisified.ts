import * as fs from "fs"

import Bluebird = require("bluebird");
import { Oops } from "oops-error"

declare var Promise: Bluebird<any>

export const writeFile = Bluebird.promisify(fs.writeFile)

export const extendedExec = cmdExec => (...args) =>
  new Promise((res, rej) =>
    cmdExec.extendedExec(
      ...args,
      (error, errCode, stdOut) => {
        const err = new Oops({
          message:error,
          category:"OperationalError",
          context:{
            errCode,
            stdOut
          }
        })
        rej(err)
      },
      res
    )
  )
