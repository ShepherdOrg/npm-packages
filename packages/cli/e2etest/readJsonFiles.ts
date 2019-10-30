import * as path from "path"

const Future = require("fluture")
const fs = require("fs")
const glob = Future.encaseN(require("glob"))
const readFile = Future.encaseN(fs.readFile)
export const readJsonFiles = (directory, jsonFileGlob) =>
  glob(path.join(directory, jsonFileGlob)).chain(matchingFileNames =>
    Future.parallel(4)(
      matchingFileNames
        .filter(x => !x.includes("/node_modules/"))
        .map(packageFileName =>
          readFile(packageFileName).map(x => JSON.parse(x.toString()))
        )
    )
  )
