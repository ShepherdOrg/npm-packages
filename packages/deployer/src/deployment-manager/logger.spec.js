const expect = require("chai").expect

describe("logger", function() {
  it("should log nicely", function() {
    let logger = require("./logger")({
      log: (arg1, arg2) => {
        expect(arg2).to.contain("TestLogLine")
      },
    })
    logger.info("TestLogLine")
  })
})
