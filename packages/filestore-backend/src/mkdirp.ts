// Code hijacked from https://stackoverflow.com/questions/31645738/how-to-create-full-path-with-nodes-fs-mkdirsync
import fs from "fs"
import path from "path"

const mkdir = (path: fs.PathLike) =>
  new Promise((res, rej) => fs.mkdir(path, err => (err ? rej(err) : res())))

export function mkdirp(targetDir, { isRelativeToScript = false } = {}) {
  const sep = path.sep
  const initDir = path.isAbsolute(targetDir) ? sep : ""
  const baseDir = isRelativeToScript ? __dirname : "."

  return targetDir.split(sep).reduce(async (parentPromise, childDir) => {
    const parentDir = await parentPromise
    const curDir = path.resolve(baseDir, parentDir, childDir)
    try {
      await mkdir(curDir)
    } catch (err) {
      if (err.code === "EEXIST") {
        // curDir already exists!
        return curDir
      }

      // To avoid `EISDIR` error on Mac and `EACCES`-->`ENOENT` and `EPERM` on Windows.
      if (err.code === "ENOENT") {
        // Throw the original parentDir error on curDir `ENOENT` failure.
        throw new Error(`EACCES: permission denied, mkdir '${parentDir}'`)
      }

      const caughtErr = ["EACCES", "EPERM", "EISDIR"].includes(err.code)
      if (!caughtErr || (caughtErr && targetDir === curDir)) {
        throw err // Throw if it's just the last created dir.
      }
    }

    return curDir
  }, Promise.resolve(initDir))
}
