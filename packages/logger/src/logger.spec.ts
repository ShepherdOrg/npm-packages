import { strict as assert } from "node:assert"
import { describe, it, before } from "node:test"
import { createLogger, ILog, TLogContext } from "./logger"
import * as chalk from "chalk"

describe("logger", function() {
  let logLines: string[] = []

  function createFakeLogger() {
    logLines = []
    return {
      log: (...args: any[]) => {
        logLines.push(args.join(" "))
      },
    } as typeof console
  }

  describe("with default options", function() {
    let logger: ILog

    before(() => {
      logger = createLogger(createFakeLogger())
    })

    it("should forward log directly", function() {
      logger.info("TestLogLine")
      assert.strictEqual(logLines.length, 1)
      assert.ok(logLines.includes("TestLogLine"))
    })
  })

  describe("with default log context set", function() {
    let logger: ILog

    before(() => {
      logger = createLogger(createFakeLogger(), { defaultContext: { color: chalk.bgBlackBright, prefix: ">        " } })
    })

    it("should add color and prefix from default context", () => {
      logger.info("Dude")
      // console.debug(`logLines \n${logLines.join('\n')}`)
      assert.strictEqual(escape(logLines[0]), escape(`${chalk.bgBlackBright(">         |")} Dude`))
    })
  })

  describe("with performance logging enabled", function() {
    let logger: ILog

    before(() => {
      logger = createLogger(createFakeLogger())
    })

    it("should add elapsed milliseconds entry after each log", function() {
      logger.info("TestLogLine", { performanceLog: true })

      assert.strictEqual(logLines.length, 2)
      assert.strictEqual(logLines[0], "TestLogLine")
      assert.ok(logLines[1].includes("ms elapsed"))
    })
  })

  describe("with color prefix enabled", function() {
    let logger: ILog

    before(() => {
      logger = createLogger(createFakeLogger())
    })

    it("should add colored prefix line before each logged line", function() {
      logger.info("TestLogLine \nTestLogLineTwo", { color: chalk.green, performanceLog: false, prefix: "MyPrefix " })

      let escapedLines = logLines.map(line => escape(line))
      assert.strictEqual(logLines.length, 2)
      assert.strictEqual(escapedLines[0], escape(`${chalk.green("MyPrefix  |")} TestLogLine `))
    })
  })

  describe("logging unexpected input", function() {
    let logger: ILog

    before(() => {
      logger = createLogger(createFakeLogger())
      logger.info(undefined, { color: chalk.green, performanceLog: false, prefix: "MyPrefix " })
      logger.info(null, { color: chalk.green, performanceLog: false, prefix: "MyPrefix " })
    })

    it("should log undefined if input is undefined", () => {
      assert.ok(logLines[0].includes("undefined"))
    })

    it("should log null if input is null", () => {
      assert.ok(logLines[1].includes("null"))
    })
  })

  describe("with terminal width limits and color prefix enabled", function() {
    let logger: ILog

    before(() => {
      logger = createLogger(createFakeLogger(), { maxWidth: 30 })
    })

    it("should add colored prefix line before each logged line and wordwrap", function() {
      let testContext: TLogContext = { color: chalk.green, performanceLog: false, prefix: "MyPrefix " }
      logger.info(
        "TestLONGLogLineTestLONGLogLineTestLONGLogLineTestLONGLogLineTestLONGLogLineTestLONGLogLineTestLONGLogLineTestLONGLogLineTestLONGLogLineTestLONGLogLine",
        testContext
      )

      let escapedLines = logLines.map(line => escape(line))
      // Uncomment to see how this looks like
      // console.debug(`logLines \n${logLines.join('\n')}`)
      assert.strictEqual(logLines.length, 9)
      assert.strictEqual(escapedLines[0], escape(`${chalk.green("MyPrefix  |")} TestLONGLogLineTes`))
    })
  })
})
