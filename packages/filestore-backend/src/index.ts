import path from "path"

import fs from "fs"

import { mkDirByPathSync } from "./mkdirp"
import { IStorageBackend } from "@shepherdorg/state-store"

function fileNamify(keyString) {
  return keyString.replace(/\//g, "_")
}

export function FileStore(config): IStorageBackend {
  return {
    connect() {
      return new Promise(function(resolve, reject) {
        if (!config.directory) {
          return reject("Must pass in config with valid directory field")
        }
        if (!fs.existsSync(config.directory)) {
          mkDirByPathSync(config.directory)
        }
        resolve()
      })
    },
    disconnect() {
      // This is a noop in this implementation.
      return Promise.resolve()
    },
    get(key) {
      return new Promise(function(resolve, reject) {
        let fileName = path.join(config.directory, fileNamify(key))
        if (fs.existsSync(fileName)) {
          fs.readFile(fileName, "utf8", (err, data) => {
            if (err)
              return reject(
                `Error when reading ${fileName} from file store: ${err}`
              )
            try {
              let parsed = JSON.parse(data)
              resolve({ key: key, value: parsed })
            } catch (e) {
              return reject(
                `Error when parsing data for ${fileName} in file store: ${e}`
              )
            }
          })
        } else {
          resolve({ key: key, value: undefined })
        }
      })
    },
    set(key, value) {
      return new Promise(function(resolve, reject) {
        let fileName = path.join(config.directory, fileNamify(key))
        fs.writeFile(fileName, JSON.stringify(value), err => {
          if (err)
            return reject(
              "Error when writing " + fileName + " to file store: " + err
            )
          resolve({
            key: key,
            value: value,
          })
        })
      })
    },
  }
}
