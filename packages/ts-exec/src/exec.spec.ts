import { exec, TExecResult } from "./exec"
import { expect } from "chai"
import { createFakeLogger } from "@shepherdorg/deployer/dist/test-tools/fake-logger"

describe("Command execution", function() {
  describe("executing ls, returning output buffers", function() {
    let execResult: TExecResult
    before(async () => {
      execResult = await exec("ls", ["-la"])
    })
    it("should execute ls", () => {
      expect(execResult.stdout).to.include("package.json")
    })
  })

  describe("executing ls, not returning output buffers", function() {
    let execResult: TExecResult
    before(async () => {
      execResult = await exec("ls", ["-la"], { doNotCollectOutput: true })
    })
    it("should return empty string", () => {
      expect(execResult.stdout).to.equal("")
    })
  })

  describe("executing ls, directing output to log", function() {
    let execResult: TExecResult
    let outHandler = createFakeLogger()
    before(async () => {
      execResult = await exec("ls", ["-l"], { doNotCollectOutput: true }, outHandler)
    })

    it("should direct stdout to logger info method", () => {
      expect(outHandler.logLevelEntries("info")[0][0]).to.contain("package.json")
    })
  })

  describe("executing failscript, directing output to buffer", function() {
    let execResult: TExecResult
    let outHandler = createFakeLogger()
    let caughtError: any
    before(async () => {
      try {
        execResult = await exec("./src/testscript/fail.sh", ["a", "b"], undefined, outHandler)
      } catch (err) {
        caughtError = err
      }
    })

    it("should throw exception on process close with error", () => {
      expect(caughtError.code).to.equal(42)
    })

    it("should direct stdout to logger error method", () => {
      expect(outHandler.logLevelEntries("error")[0][0]).to.contain("must go to stderr")
    })

    it("should have error output in error", () => {
      expect(caughtError.stderr).to.contain("must go to stderr")
    })

    it("should have stdoutput in error", () => {
      expect(caughtError.stdout).to.contain("must go to stdout\n")
    })

    it("should specify command and exit code in exception", () => {
      expect(caughtError.message).to.equal("./src/testscript/fail.sh a b exited with error code 42")
    })
  })
})
