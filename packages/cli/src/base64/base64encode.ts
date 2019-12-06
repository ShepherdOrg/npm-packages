#!/usr/bin/env node

function stdInBuffer() {
  const stdin = process.stdin

  const result: any = []
  let length = 0

  // @ts-ignore
  return new Promise(resolve => {
    if (stdin.isTTY) {
      resolve(Buffer.concat([]))
      return
    }

    stdin.on("readable", () => {
      let chunk

      while ((chunk = stdin.read())) {
        result.push(chunk)
        length += chunk.length
      }
    })

    stdin.on("end", () => {
      resolve(Buffer.concat(result, length))
    })
  })
}


function main() {

  stdInBuffer().then((stdinBuf:Buffer) => {
    console.info(stdinBuf.toString("base64"))
  })
}

main()
