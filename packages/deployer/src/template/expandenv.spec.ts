import { expect } from "chai"

import { expandEnv } from "./expandenv"
import * as chalk from "chalk"

describe("expand environment vars in string", function() {
  beforeEach(function() {
    process.env.ENVVAR_ONE = "TESTVALUE"
  })

  afterEach(function() {
    delete process.env.ENVVAR_ONE
  })

  it("should expand simple variable", function() {
    let rawText = "${ENVVAR_ONE}"

    let expandedText = expandEnv(rawText)

    expect(expandedText).to.equal("TESTVALUE")
  })

  it("should throw on missing variable", function() {
    let rawText = "${ENVVAR_MISSING}"

    try {
      expandEnv(rawText)
    } catch (e) {
      expect(escape(e.message)).to.equal(escape(`Reference to environment variable \${${chalk.red("ENVVAR_MISSING")}} could not be resolved: \${ENVVAR_MISSING}`)      )
    }
  })
})
