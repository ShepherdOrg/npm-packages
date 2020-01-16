import { expect } from "chai"
import { CreateLogger } from "./logger"

describe("logger", function() {
  it("should log nicely", function() {
    let logger = CreateLogger({
      log: (_arg1:any, arg2:string) => {
        expect(arg2).to.contain("TestLogLine")
      },
    } as typeof console)
    logger.info("TestLogLine")
  })
})
