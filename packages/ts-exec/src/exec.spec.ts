import { exec, TExecResult } from "./exec"
import { strict as assert } from "node:assert"
import { describe, it, before } from "node:test"
import { createFakeLogger } from "@shepherdorg/logger"

describe("Command execution. Tests only work in a posix shell.", function() {
  describe("executing ls, returning output buffers", function() {
    let execResult: TExecResult
    before(async () => {
      execResult = await exec("ls", ["-la"])
    })
    it("should execute ls", () => {
      assert.ok(execResult.stdout.includes("package.json"))
    })
  })

  describe("executing ls, not returning output buffers", function() {
    let execResult: TExecResult
    before(async () => {
      execResult = await exec("ls", ["-la"], { doNotCollectOutput: true })
    })
    it("should return empty string", () => {
      assert.strictEqual(execResult.stdout, "")
    })
    it("should return actual command run with result", () => {
      assert.strictEqual(execResult.command, "ls -la")
    })
  })

  describe("executing ls, directing output to log", function() {
    let execResult: TExecResult
    let outHandler = createFakeLogger()
    before(async () => {
      execResult = await exec("ls", ["-l"], { doNotCollectOutput: true }, outHandler)
    })

    it("should direct stdout to logger info method", () => {
      assert.ok(outHandler.logLevelEntries("info")[0][0].includes("package.json"))
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
      assert.strictEqual(caughtError.code, 42)
    })

    it("should direct stdout to logger error method", () => {
      assert.ok(outHandler.logLevelEntries("error")[0][0].includes("must go to stderr"))
    })

    it("should have error output in error", () => {
      assert.ok(caughtError.stderr.includes("must go to stderr"))
    })

    it("should have stdoutput in error", () => {
      assert.ok(caughtError.stdout.includes("must go to stdout\n"))
    })

    it("should specify command and exit code in exception", () => {
      assert.strictEqual(caughtError.message, "./src/testscript/fail.sh a b. Process exited with error code 42")
    })
  })

  describe("writing a string to stdin on child process", function() {
    let execResult: TExecResult
    let outHandler = createFakeLogger()
    let caughtError: any
    before(async () => {
      try {
        execResult = await exec("cat", [], { stdin: "This is the input, catted to output" }, outHandler)
      } catch (err) {
        caughtError = err
      }
    })

    it("should get the input out again through cat", () => {
      assert.strictEqual(execResult.stdout, "This is the input, catted to output")
    })
  })
})
