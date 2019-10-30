import path from "path"

import fs from "fs"

import { mkdirp } from "./mkdirp"
import { IStorageBackend } from "@shepherdorg/state-store"

function fileNamify(keyString) {
  return keyString.replace(/\//g, "_")
}

const exists = (path: fs.PathLike) =>
  new Promise<boolean>(res => fs.exists(path, res))

const readFile = (path: fs.PathLike, encoding: string): Promise<string> =>
  new Promise((res, rej) =>
    fs.readFile(path, encoding, (err, data) => (err ? rej(err) : res(data)))
  )
const writeFile = (path: fs.PathLike, content: Buffer | string) =>
  new Promise((res, rej) =>
    fs.writeFile(path, content, err => (err ? rej(err) : res()))
  )

interface FileStoreConfig {
  directory: string
}

export function FileStore(config: FileStoreConfig): IStorageBackend {
  return {
    async connect() {
      if (!config.directory) {
        throw "Must pass in config with valid directory field"
      }
      if (!(await exists(config.directory))) {
        await mkdirp(config.directory)
      }
    },
    async disconnect() {
      // This is a noop in this implementation.
      return
    },
    async get(key) {
      const fileName = path.join(config.directory, fileNamify(key))
      if (await exists(fileName)) {
        let data: string
        try {
          data = await readFile(fileName, "utf8")
        } catch (err) {
          throw `Error when reading ${fileName} from file store: ${err}`
        }
        try {
          const parsed = JSON.parse(data)
          return { key, value: parsed }
        } catch (err) {
          throw `Error when parsing data for ${fileName} in file store: ${err}`
        }
      } else {
        return { key, value: undefined }
      }
    },
    async set(key, value) {
      const fileName = path.join(config.directory, fileNamify(key))
      try {
        await writeFile(fileName, JSON.stringify(value))
        return { key, value }
      } catch (err) {
        throw `Error when writing ${fileName} to file store: ${err}`
      }
    },
  }
}
