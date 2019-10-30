const JsDiff = require("diff")
const fs = require("fs")
const expect = require("expect.js")
const _ = require("lodash")

const exec = require("@shepherdorg/exec")

function containsDifference(diffArray) {
  for (let diffObj of diffArray) {
    if (diffObj.removed || diffObj.added) {
      return true
    }
  }
  return false
}

function renderDifferences(diffArray) {
  let result = ""
  for (let diffObj of diffArray) {
    if (diffObj.added) {
      result += "\n        not expecting: " + diffObj.value
    }
    if (diffObj.removed) {
      result += "\nexpecting but missing: " + diffObj.value
    }
  }
  return result
}

function compareActualVsExpected(expectedFileName, actualFileName) {
  let expectedFileContents = fs.readFileSync(expectedFileName, "utf-8")
  let actualFileContents = fs.readFileSync(actualFileName, "utf-8")
  let difference = JsDiff.diffTrimmedLines(
    expectedFileContents.trim(),
    actualFileContents.trim()
  )
  if (containsDifference(difference)) {
    expect().fail(
      "Expected file " +
        expectedFileName +
        " differs from actual file " +
        actualFileName +
        "\n" +
        renderDifferences(difference)
    )
  }
}

module.exports = {
  // Pass in debug=true if you want to see output of subject under test.
  execute: function(command, args, options) {
    let logfn = undefined

    options.stdoutLineHandler = function(line) {
      if (options.debug) {
        console.log(line.trim())
      }
    }
    options.env = _.extend({}, options.env, { PATH: process.env.PATH })

    exec.extendedExec(
      command,
      args,
      options,
      function(err, errCode, stdout) {
        if (execution.expectedExitCode) {
          expect(errCode).to.equal(execution.expectedExitCode)
          execution.processOutput = stdout
          execution.processStderr = err.trim()
          execution.checkExpectations()
          execution.callback(stdout)
        } else {
          console.error(
            "Process error in test, error code:",
            errCode,
            " stderr:",
            err
          )
          expect().fail(
            "Error invoking : " +
              command +
              " with arguments " +
              JSON.stringify(args) +
              "\nStdout: \n" +
              stdout +
              "\nError output:\n" +
              err +
              "\n. ErrorCode:" +
              errCode
          )
        }
      },
      function(output) {
        execution.processOutput = output
        execution.checkExpectations()
        execution.callback(output)
      },
      logfn
    )

    let execution = {
      output: function(actualOutputFileOrDir) {
        execution.actualOutputFileOrDir = actualOutputFileOrDir
        return {
          shouldEqual(expectedOutputFileOrDir) {
            execution.expectedOutputFileOrDir = expectedOutputFileOrDir
            return execution
          },
          shouldBeEmptyDir() {
            execution.dirShouldBeEmpty = true
            return execution
          },
        }
      },
      stdout: function() {
        execution.actualFromStdout = true
        return {
          shouldEqual(expectedStdOutputRefFile) {
            execution.expectedStdOutput = expectedStdOutputRefFile
            return execution
          },
        }
      },
      stderr: function() {
        execution.actualFromStderr = true
        return {
          shouldEqual(expectedOutputFileOrDir) {
            execution.expectedOutputFileOrDir = expectedOutputFileOrDir
            return execution
          },
          shouldBeEmptyDir() {
            execution.dirShouldBeEmpty = true
            return execution
          },
        }
      },
      expectExitCode: function(expectedExitCode) {
        execution.expectedExitCode = expectedExitCode
        return execution
      },
      done(callback) {
        execution.callback = callback
      },
      checkExpectations() {
        if (execution.actualFromStderr) {
          if (
            !(execution.processStderr === execution.expectedOutputFileOrDir)
          ) {
            expect().fail(
              "Standard err " +
                execution.processStderr +
                " does not match expected " +
                execution.expectedOutputFileOrDir +
                " error output"
            )
          }
          return
        }

        if (execution.actualFromStdout) {
          let expectedOutput
          if (fs.existsSync(execution.expectedStdOutput)) {
            expectedOutput = fs.readFileSync(
              execution.expectedStdOutput,
              "utf-8"
            )
          } else {
            expectedOutput = execution.expectedStdOutput
          }

          let difference = JsDiff.diffTrimmedLines(
            expectedOutput.trim(),
            execution.processOutput.trim()
          )
          if (containsDifference(difference)) {
            fs.writeFileSync(
              "./e2etest/expected/actualoutput.log",
              execution.processOutput
            )
            expect().fail(
              "Expected stdout \n" +
                expectedOutput +
                "\n differs from actual stdout \n" +
                execution.processOutput +
                "\n Differences found:" +
                renderDifferences(difference)
            )
          }
        } else {
          if (
            !execution.expectedOutputFileOrDir &&
            !execution.actualOutputFileOrDir
          ) {
            return
          }
          let actualIsDir = fs
            .lstatSync(execution.actualOutputFileOrDir)
            .isDirectory()
          if (execution.dirShouldBeEmpty) {
            if (actualIsDir) {
              let actualFiles = _.sortedUniq(
                fs.readdirSync(execution.actualOutputFileOrDir)
              )
              if (actualFiles.length > 0) {
                expect().fail(
                  `Directory ${
                    execution.actualOutputFileOrDir
                  } is not empty, contains following files: ${actualFiles.join(
                    ", "
                  )}`
                )
              }
            } else {
              expect().fail("Actual is not a directory!")
            }
            return
          }
          let expectedIsDir = fs
            .lstatSync(execution.expectedOutputFileOrDir)
            .isDirectory()
          if (
            (expectedIsDir || actualIsDir) &&
            !(expectedIsDir && actualIsDir)
          ) {
            expect().fail(
              "Both expected and actual must be a directory or a file"
            )
          }
          if (expectedIsDir) {
            let expectedFiles = _.sortedUniq(
              fs.readdirSync(execution.expectedOutputFileOrDir)
            )
            let actualFiles = _.sortedUniq(
              fs.readdirSync(execution.actualOutputFileOrDir)
            )
            let expectedFilesString = expectedFiles.join("\n")
            let actualFilesString = actualFiles.join("\n")

            let difference = JsDiff.diffTrimmedLines(
              expectedFilesString,
              actualFilesString
            )
            if (containsDifference(difference)) {
              expect().fail(
                "Expected directory contents " +
                  execution.expectedOutputFileOrDir +
                  " differs from actual dir contents " +
                  execution.actualOutputFileOrDir +
                  "\n" +
                  renderDifferences(difference)
              )
            }
            _.each(actualFiles, function(file) {
              compareActualVsExpected(
                execution.expectedOutputFileOrDir + "/" + file,
                execution.actualOutputFileOrDir + "/" + file
              )
            })
          } else {
            let expectedFileName = execution.expectedOutputFileOrDir
            let actualFileName = execution.actualOutputFileOrDir
            compareActualVsExpected(expectedFileName, actualFileName)
          }
        }
      },
    }

    return execution
  },
}
