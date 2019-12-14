import { expect } from "chai"

describe("logger", function() {
  it("should log nicely", function() {
    let logger = require("./logger")({
      log: (_arg1:any, arg2:string) => {
        expect(arg2).to.contain("TestLogLine")
      },
    })
    logger.info("TestLogLine")
  })
})
