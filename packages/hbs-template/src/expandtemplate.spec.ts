import { expect } from "chai"
import { expandTemplate } from "./expandtemplate"


describe("expand environment vars using handlebars template syntax", function() {
  beforeEach(function() {
    process.env.ENVVAR_ONE = "TESTVALUE"
  })

  afterEach(function() {
    delete process.env.ENVVAR_ONE
  })

  it("should expand simple variable", function() {
    let rawText = "{{ENVVAR_ONE}}"

    let expandedText = expandTemplate(rawText, process.env)

    expect(expandedText).to.equal("TESTVALUE")
  })

  it("should throw on missing variable", () => {
    try {
      expandTemplate("{{ENVVAR_MISSING}}", process.env)
    } catch (err) {
      expect(err.message).to.contain("Available properties:")
    }
  })

  it("should list available properties", () => {
    try {
      expandTemplate("{{ENVVAR_MISSING}}", process.env)
    } catch (err) {
      expect(err.message).to.contain("Available properties:")
      expect(err.message).to.contain("ENVVAR_ONE")
    }
  })

  describe("Base64 encode", () => {
    it("Should support base64 encode", () => {
      let rawText = "ENCODED: {{Base64Encode ENVVAR_ONE }}"

      let expandedText = expandTemplate(rawText, process.env)

      expect(expandedText).to.equal("ENCODED: VEVTVFZBTFVF")
    })

    it("Should support base64 encode with newline appended", () => {
      let rawText = 'ENCODED: {{{Base64Encode ENVVAR_ONE "\n"}}}'

      let expandedText = expandTemplate(rawText, process.env)

      expect(expandedText).to.equal("ENCODED: VEVTVFZBTFVFCg==")
    })

    it("should throw meaningful error if variable not set", () => {
      let rawText = 'ENCODED: {{{ Base64Encode SOME_BULLSHIT }}}'
      try{
        expandTemplate(rawText, process.env)
      }catch(err){
        expect(err.message).to.equal("Error expanding template block: {{{ Base64Encode SOME_BULLSHIT }}}. Variable not set, in line# 1")
      }
    })
  })

  describe("Base64 encode file", () => {
    before(()=>{
      process.env.ENVVAR_ONE_FILE = __dirname + '/testdata/unencoded-file.txt'
      process.env.ENVVAR_BINARY_FILE = __dirname + '/testdata/testfile.bin'
      process.env.ENVVAR_ONE_FILE_DOES_NOT_EXIST = __dirname + '/testdata/does-not-exist.txt'
    })

    after(()=>{
      delete process.env.ENVVAR_ONE_FILE
      delete process.env.ENVVAR_ONE_FILE_DOES_NOT_EXIST
      delete process.env.ENVVAR_BINARY_FILE
    })

    it("Should support base64 encode", () => {
      let rawText = "ENCODED: {{Base64EncodeFile ENVVAR_ONE_FILE }}"
      let expandedText = expandTemplate(rawText, process.env)
      expect(expandedText).to.equal("ENCODED: dGhpcy10ZXh0LXdpbGwtYmUtZW5jb2RlZC1pbi1hLXRlc3QK")
    })

    it("Should support base64 encode binary file", () => {
      let rawText = "ENCODED FILE: {{ Base64EncodeFile ENVVAR_BINARY_FILE }}"
      let expandedText = expandTemplate(rawText, process.env)
      expect(expandedText).to.equal("ENCODED FILE: R0lGODlhMgAyAPcAAJaMc2ZeRca7n3tyWkdHR4qBZcrBpsnBrO7q3cjFvIw=")
    })

    it("Should throw meaningful error if file does not exist", () => {
      let rawText = "ENCODED: {{Base64EncodeFile ENVVAR_ONE_FILE_DOES_NOT_EXIST }}"
      try{
        expandTemplate(rawText, process.env)
      }catch(err){
        expect(err.message).to.contain("/testdata/does-not-exist.txt")
      }
    })

    it("Should throw meaningful error if variable is not set in environment", () => {
      let rawText = "\n\nENCODED: {{ Base64EncodeFile ENVVAR_ONE_FILE_NOT_SET }}\n\n"
      try{
        expandTemplate(rawText)
      }catch(err){
        expect(err.message).to.equal("Error expanding template block: {{ Base64EncodeFile ENVVAR_ONE_FILE_NOT_SET }}. Variable pointing to file to base64 encode is not set, in line# 3")
      }
    })
  })


/*
  import * as fs from "fs"
  describe("read/write binary test file", function() {

    it("should create file", () => {
      var foo = "71%73%70%56%57%97%50%0%50%0%247%0%0%150%140%115%102%94%69%198%187%159%123%114%90%71%71%71%138%129%101%202%193%166%201%193%172%238%234%221%200%197%188%140"
      var bytes = foo.split("%");

      var buf = Buffer.alloc(bytes.length);
      for (var i = 0;i < bytes.length;i++) {
        buf[i] = parseInt(bytes[i], 10);
      }

      fs.writeFile(__dirname + "/testdata/testfile.bin", buf,  "binary",function(err) {
        if(err) {
          console.log(err);
        } else {
          console.log("The file was saved!");
        }
      });

      fs.writeFile(__dirname + "/testdata/testfile-base64.txt", buf.toString('base64'),  function(err) {
        if(err) {
          console.log(err);
        } else {
          console.log("The base64 file was saved!");
        }
      });
    })
  })
*/

})
