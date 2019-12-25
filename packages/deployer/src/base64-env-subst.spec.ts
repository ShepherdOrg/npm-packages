import { base64Encode, processLine } from "./base64-env-subst"
import { expect } from "chai"

describe("expanding and decoding base64 encoded variables", function() {

  before(()=>{
    process.env.JUST_A_VARIABLE = 'some value to encode'
    process.env.BASE64_ENCODED_VARIABLE = base64Encode('something different')
  })

  after(()=>{
    delete process.env.JUST_A_VARIABLE
    delete process.env.BASE64_ENCODED_VARIABLE
  })

  it("should expand base 64 encoded variable in middle of line", () => {
    const inputString = "   ${Base64Decode:BASE64_ENCODED_VARIABLE}  more\n"
    const output = processLine(inputString, {appendNewline:false})
    expect(output).to.equal('   something different  more\n')
  })

  it("should expand and encode variable in middle of line", () => {
    const inputString = "   ${Base64Encode:JUST_A_VARIABLE}  more\n"
    const output = processLine(inputString, {appendNewline:false})
    expect(output).to.equal('   c29tZSB2YWx1ZSB0byBlbmNvZGU=  more\n')
  })

  it("should expand multiple variables", () => {
    const inputString = "   ${Base64Encode:JUST_A_VARIABLE}  ${Base64Decode:BASE64_ENCODED_VARIABLE}"
    const output = processLine(inputString, {appendNewline:false})
    expect(output).to.equal('   c29tZSB2YWx1ZSB0byBlbmNvZGU=  something different')
  })

})
