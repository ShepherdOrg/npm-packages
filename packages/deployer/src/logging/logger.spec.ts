import { expect } from "chai"
import { createLogger, ILog, TLogContext } from "./logger"
import * as chalk from "chalk"

describe("logger", function() {

  let logLines: string[] = []

  function createFakeLogger() {
    logLines =[]
    return {
      log: (...args: any[]) => {
        logLines.push(args.join(" "))
      },
    } as typeof console
  }

  describe("with default options", function() {
    let logger: ILog

    before(()=>{
      logger = createLogger(createFakeLogger())
    })

    it("should forward log directly", function() {
      logger.info("TestLogLine")
      expect(logLines.length).to.equal(1)
      expect(logLines).to.contain("TestLogLine")
    })

  })

  describe('with default log context set', function(){
    let logger: ILog

    before(()=>{
      logger = createLogger(createFakeLogger(), {defaultContext: {color: chalk.bgGray, prefix: '>        '}})
    })

    it("should add color and prefix from default context", () => {
      logger.info('Dude')
      // console.debug(`logLines \n${logLines.join('\n')}`)
      expect(escape(logLines[0])).to.equal(escape(`${chalk.bgGray('>         |')} Dude`))
    })

  })

  describe("with performance logging enabled", function() {
    let logger: ILog

    before(()=>{
      logger = createLogger(createFakeLogger())
    })

    it("should add elapsed milliseconds entry after each log", function() {
      logger.info("TestLogLine", { performanceLog: true })

      expect(logLines.length).to.equal(2)
      expect(logLines[0]).to.equal("TestLogLine")
      expect(logLines[1]).to.contain("ms elapsed")
    })

  })

  describe("with color prefix enabled", function() {
    let logger: ILog

    before(()=>{
      logger = createLogger(createFakeLogger() )
    })

    it("should add colored prefix line before each logged line", function() {
      logger.info("TestLogLine \nTestLogLineTwo", { color: chalk.green, performanceLog: false, prefix: "MyPrefix " })

      let escapedLines = logLines.map((line)=>escape(line))
      expect(logLines.length).to.equal(2)
      expect(escapedLines[0]).to.equal(escape(`${chalk.green("MyPrefix  |")} TestLogLine `))
    })
  })

  describe('logging unexpected input', function () {
    let logger: ILog

    before(()=>{
      logger = createLogger(createFakeLogger() )
      logger.info(undefined, { color: chalk.green, performanceLog: false, prefix: "MyPrefix " })
      logger.info(null, { color: chalk.green, performanceLog: false, prefix: "MyPrefix " })
    })

    it('should log undefined if input is undefined', () => {
      expect(logLines[0]).to.contain('undefined')
    });

    it('should log null if input is null', () => {
      expect(logLines[1]).to.contain('null')
    });

  });


  describe("with terminal width limits and color prefix enabled", function() {
    let logger: ILog

    before(()=>{
      logger = createLogger(createFakeLogger(), { maxWidth: 30})
    })

    it("should add colored prefix line before each logged line and wordwrap", function() {
      let testContext:TLogContext = { color: chalk.green, performanceLog: false, prefix: "MyPrefix " }
      logger.info("TestLONGLogLineTestLONGLogLineTestLONGLogLineTestLONGLogLineTestLONGLogLineTestLONGLogLineTestLONGLogLineTestLONGLogLineTestLONGLogLineTestLONGLogLine", testContext)

      let escapedLines = logLines.map((line)=>escape(line))
      // Uncomment to see how this looks like
      // console.debug(`logLines \n${logLines.join('\n')}`)
      expect(logLines.length).to.equal(9)
      expect(escapedLines[0]).to.equal(escape(`${chalk.green("MyPrefix  |")} TestLONGLogLineTes`))
    })
  })
})
