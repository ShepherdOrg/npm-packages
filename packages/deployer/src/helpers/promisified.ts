import * as fs from "fs"
import { Oops } from "oops-error"

// @ts-ignore
import Bluebird = require("bluebird")

export const writeFile = Bluebird.promisify(fs.writeFile)
