import * as fs from "fs"
import { Oops } from "oops-error"

// @ts-ignore
import Bluebird = require("bluebird")

export const writeFile = Bluebird.promisify(fs.writeFile)

export const extendedExec = (cmdExec:any) => (...args: any) =>
  new Promise((res:any, rej:any) =>
    cmdExec.extendedExec(
      ...args,
      (error:string, errCode:number, stdOut:string) => {
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
