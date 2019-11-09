const expandtemplate = require("./expandtemplate")
const expect = require("chai").expect

describe("expand environment vars using handlebars template syntax", function() {
  beforeEach(function() {
    process.env.ENVVAR_ONE = "TESTVALUE"
  })

  afterEach(function() {
    delete process.env.ENVVAR_ONE
  })

  it("should expand simple variable", function() {
    let rawText = "{{ENVVAR_ONE}}"

    let expandedText = expandtemplate(rawText)

    expect(expandedText).to.equal("TESTVALUE")
  })

  it("should throw on missing variable", () => {
    try {
      expandtemplate("{{ENVVAR_MISSING}}")
    } catch (err) {
      expect(err.message).to.contain("Available properties:")
    }
  })

  it("should list available properties", () => {
    try {
      expandtemplate("{{ENVVAR_MISSING}}")
    } catch (err) {
      expect(err.message).to.contain("Available properties:")
      expect(err.message).to.contain("ENVVAR_ONE")
    }
  })

  describe("Base64 encode", () => {
    it("Should support base64 encode", () => {
      let rawText = "ENCODED: {{Base64Encode ENVVAR_ONE }}"

      let expandedText = expandtemplate(rawText)

      expect(expandedText).to.equal("ENCODED: VEVTVFZBTFVF")
    })

    it("Should support base64 encode with newline appended", () => {
      let rawText = 'ENCODED: {{{Base64Encode ENVVAR_ONE "\n"}}}'

      let expandedText = expandtemplate(rawText)

      expect(expandedText).to.equal("ENCODED: VEVTVFZBTFVFCg==")
    })
  })
})
