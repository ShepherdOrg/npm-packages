import { FExecutionCallback, TFileSystemPath } from "../basic-types"
import * as fs from "fs"

const JsDiff = require("diff")

const expect = require("expect.js")
const { extend, sortedUniq } = require("lodash")

const exec = require("@shepherdorg/exec")

declare type TJsDifference = {
  value: string
  added: boolean
  removed: boolean
}

function relevantDifferences(diffArray:Array<TJsDifference>, ignoreList: string[] = []):Array<TJsDifference> {
  let result: Array<TJsDifference> = []
  for (let diffObj of diffArray) {
    if (diffObj.removed || diffObj.added) {
      const onIgnoreList = ignoreList.reduce((ignored, ignoredWord) => {
        return ignored || diffObj.value.indexOf(ignoredWord) >= 0
      }, false)
      if (!onIgnoreList) {
        result.push(diffObj)
      }
    }
  }
  return result
}

function renderDifferences(diffArray: Array<TJsDifference>): string {
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

function compareActualVsExpected(expectedFileName:TFileSystemPath, actualFileName:TFileSystemPath, ignoreList: string[] = []) {
  let expectedFileContents = fs.readFileSync(expectedFileName, "utf-8")
  let actualFileContents = fs.readFileSync(actualFileName, "utf-8")
  let difference = JsDiff.diffTrimmedLines(expectedFileContents.trim(), actualFileContents.trim())
  let relevantDiff = relevantDifferences(difference, ignoreList)
  if (relevantDiff.length) {
    expect().fail(
      "Expected file xxxxxx " +
        expectedFileName +
        " differs from actual file " +
        actualFileName +
        "\n" +
        renderDifferences(relevantDiff)
    )
  }
}

type TOutputDSL = {
  shouldBeEmptyDir(): TScriptTestExecution
  shouldEqual(expectedOutputFileOrDir: any): TScriptTestExecution
}

type TStdOutDSL = {
  shouldContain(partialString: string): TScriptTestExecution
  shouldEqual(expectedStdOutputRefFile: TFileSystemPath): TScriptTestExecution
}

type TStdErrDSL = {
  shouldBeEmptyDir(): TScriptTestExecution
  shouldEqual(expectedOutputFileOrDir: TFileSystemPath): TScriptTestExecution
}

interface TScriptTestExecution {
  expectedExitCode: number | undefined
  callback?: FExecutionCallback
  actualFromStderr: boolean
  processStderr?: string
  expectedPartialStrings: string[]
  actualFromStdout: boolean
  expectedStdOutput: string | TFileSystemPath | undefined
  processOutput: string
  dirShouldBeEmpty: boolean
  expectedOutputFileOrDir: TFileSystemPath | undefined
  actualOutputFileOrDir: TFileSystemPath | undefined
  ignoreList: string[]
  stderr: () => TStdErrDSL
  stdout: () => TStdOutDSL
  output: (actualOutputFileOrDir: TFileSystemPath) => TOutputDSL
  ignoreLinesWith: (ignoreList: string[]) => TScriptTestExecution
  expectExitCode: (expectedExitCode: number) => TScriptTestExecution
  done: (callback: FExecutionCallback) => void
  checkExpectations: () => void
}

function emptyArray<T>(): Array<T> {
  return []
}

export type TExecuteOptions = {
  env: typeof process.env
  debug?: boolean
  stdoutLineHandler?: (line: string) => void
}

export default {
  // Pass in debug=true if you want to see output of subject under test.
  execute: function(command:string, args:string[], options:TExecuteOptions) {
    let logfn = undefined

    options.stdoutLineHandler = options.stdoutLineHandler || function(line:string) {
      if (options.debug) {
        console.debug(line.trim())
      }
    }
    options.env = extend({}, options.env, { PATH: process.env.PATH })

    exec.extendedExec(
      command,
      args,
      options,
      function(err: string, errCode: number, stdout: string) {
        if (execution.expectedExitCode) {
          expect(errCode).to.equal(execution.expectedExitCode)
          execution.processOutput = stdout
          execution.processStderr = err.trim()
          execution.checkExpectations()
          execution.callback && execution.callback(stdout)
        } else {
          console.error("Process error in test, error code:", errCode, " stderr:", err)
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
      function(output: string) {
        execution.processOutput = output
        execution.checkExpectations()
        execution.callback && execution.callback(output)
      },
      logfn
    )

    let execution: TScriptTestExecution = {
      actualOutputFileOrDir: undefined,
      dirShouldBeEmpty: false,
      expectedOutputFileOrDir: undefined,
      expectedStdOutput: undefined,
      processOutput: "",
      ignoreList: emptyArray<string>(),
      expectedPartialStrings: emptyArray<string>(),
      expectedExitCode: undefined,
      actualFromStderr: false,
      actualFromStdout: false,
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
      ignoreLinesWith(ignoreList: string[]) {
        execution.ignoreList = ignoreList
        return execution
      },
      stdout: function() {
        execution.actualFromStdout = true
        return {
          shouldEqual(expectedStdOutputRefFile: TFileSystemPath) {
            execution.expectedStdOutput = expectedStdOutputRefFile
            return execution
          },
          shouldContain(partialString: string) {
            execution.expectedPartialStrings.push(partialString)
            return execution
          },
        }
      },
      stderr: function() {
        execution.actualFromStderr = true
        return {
          shouldEqual(expectedOutputFileOrDir: TFileSystemPath) {
            execution.expectedOutputFileOrDir = expectedOutputFileOrDir
            return execution
          },
          shouldBeEmptyDir() {
            execution.dirShouldBeEmpty = true
            return execution
          },
        }
      },
      expectExitCode: function(expectedExitCode: number) {
        execution.expectedExitCode = expectedExitCode
        return execution
      },
      done(callback: FExecutionCallback) {
        execution.callback = callback
      },
      checkExpectations() {
        if (execution.actualFromStderr) {
          if (!(execution.processStderr === execution.expectedOutputFileOrDir)) {
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

        execution.expectedPartialStrings.forEach((partialString: string) => {
          expect(execution.processOutput).to.contain(partialString)
        })

        if (execution.actualFromStdout) {
          let expectedOutput
          if (fs.existsSync(execution.expectedStdOutput as TFileSystemPath)) {
            expectedOutput = fs.readFileSync(execution.expectedStdOutput as TFileSystemPath, "utf-8")
          } else {
            expectedOutput = execution.expectedStdOutput
          }

          if (expectedOutput) {
            let difference = JsDiff.diffTrimmedLines(expectedOutput.trim(), execution.processOutput.trim())
            let relevant = relevantDifferences(difference, execution.ignoreList)
            if (relevant.length) {
              fs.writeFileSync("./integratedtest/expected/actualoutput.log", execution.processOutput)
              expect().fail(
                "Expected stdout \n" +
                  expectedOutput +
                  "\n differs from actual stdout \n" +
                  execution.processOutput +
                  "\n Differences found:" +
                  renderDifferences(relevant)
              )
            }
          }
        } else {
          if (!execution.expectedOutputFileOrDir && !execution.actualOutputFileOrDir) {
            return
          }
          let actualIsDir =execution.actualOutputFileOrDir && fs.lstatSync(execution.actualOutputFileOrDir).isDirectory()
          if (execution.dirShouldBeEmpty) {
            if (actualIsDir) {
              let actualFiles = sortedUniq(fs.readdirSync(execution.actualOutputFileOrDir as TFileSystemPath))
              if (actualFiles.length > 0) {
                expect().fail(
                  `Directory ${
                    execution.actualOutputFileOrDir
                  } is not empty, contains following files: ${actualFiles.join(", ")}`
                )
              }
            } else {
              expect().fail("Actual is not a directory!")
            }
            return
          }
          let expectedIsDir =
            execution.expectedOutputFileOrDir && fs.lstatSync(execution.expectedOutputFileOrDir).isDirectory()
          if ((expectedIsDir || actualIsDir) && !(expectedIsDir && actualIsDir)) {
            expect.fail("Both expected and actual must be a directory or a file")
          }
          if (expectedIsDir && execution.expectedOutputFileOrDir && execution.actualOutputFileOrDir) {
            let expectedFiles = sortedUniq(fs.readdirSync(execution.expectedOutputFileOrDir))
            let actualFiles = sortedUniq(fs.readdirSync(execution.actualOutputFileOrDir))
            let expectedFilesString = expectedFiles.join("\n")
            let actualFilesString = actualFiles.join("\n")

            let difference = JsDiff.diffTrimmedLines(expectedFilesString, actualFilesString)
            let relevantDiff = relevantDifferences(difference, execution.ignoreList)
            if (relevantDiff.length) {
              expect().fail(
                "Expected directory contents " +
                  execution.expectedOutputFileOrDir +
                  " differs from actual dir contents " +
                  execution.actualOutputFileOrDir +
                  "\n" +
                  renderDifferences(relevantDiff)
              )
            }
            actualFiles.forEach(function(file: string) {
              compareActualVsExpected(
                execution.expectedOutputFileOrDir + "/" + file,
                execution.actualOutputFileOrDir + "/" + file,
                execution.ignoreList
              )
            })
          } else {
            let expectedFileName = execution.expectedOutputFileOrDir as TFileSystemPath
            let actualFileName = execution.actualOutputFileOrDir as TFileSystemPath
            compareActualVsExpected(expectedFileName, actualFileName, execution.ignoreList)
          }
        }
      },
    }

    return execution
  },
}
