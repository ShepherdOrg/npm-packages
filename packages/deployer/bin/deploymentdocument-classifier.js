#!/usr/bin/env node
"use strict"
const readline = require("readline")
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
})

const identifyDocument = require("../src/k8s-deployment-document-identifier")

let stdin = ""

function identifyStdinDocument(stdincopy) {
  let identifyingString = identifyDocument(stdincopy).identifyingString

  if (!identifyingString) {
    console.error(
      "No identifying string found for deployment document in STDIN: " +
        stdincopy
    )
  } else {
    console.log(identifyingString.toLowerCase())
  }
  process.exit(0)
}

try {
  rl.on("line", function(line) {
    if (line.trim() === "---") {
      let stdincopy = stdin
      stdin = "" // Can I get stdin on event after process.exit is called? Probably not, but better safe than sorry.
      identifyStdinDocument(stdincopy)
    } else {
      stdin += line + "\n"
    }
  })

  rl.on("close", function() {
    identifyStdinDocument(stdin)
  })
} catch (e) {
  console.error(stdin)
  console.error("Error classifying deployment document (see above).", e)
  process.exit(255)
}
