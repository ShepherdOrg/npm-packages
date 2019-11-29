import { TTarFolderStructure } from "../index"

const tar = require("tar")
let Duplex = require("stream").Duplex

function bufferToStream(buffer:any) {
  let stream = new Duplex()
  stream.push(buffer)
  stream.push(null)
  return stream
}

export type TBase64String = string

export type TTarFileEntry = { path: string; on: (extractionEvent: string, eventHandler: (tarFileData: any) => void) => void }

export default function(base64EncodedTar:TBase64String): Promise<TTarFolderStructure> {
  return new Promise(function(resolve, reject) {
    const buffer = Buffer.from(base64EncodedTar, "base64")

    let files: TTarFolderStructure = {}

    try {
      bufferToStream(buffer)
        .pipe(new tar.Parse())
        .on("entry", (entry: TTarFileEntry) => {
          let file = {
            path: entry.path,
            content: "",
          }
          files[entry.path] = file
          entry.on("data", function(tarFileData) {
            file.content += tarFileData.toString("utf-8")
          })

          // resolve(entry);
        })
        .on("close", function() {
          resolve(files)
        })
    } catch (e) {
      reject(e)
    }
  })
}
