const fs = require("fs")
const dockerEnvGenerator = require("./docker-env-generator")()
const expect = require("chai").expect

describe("docker env file generation", function() {
  beforeEach(function() {
    !fs.existsSync(".build") && fs.mkdirSync(".build")
  })

  it("should create compatible file from map", function() {
    let map = {
      VARIABLE_ONE: "one",
      VARIABLE_TWO: 2,
    }

    dockerEnvGenerator.generateEnvFile(".build/envfile", map)

    const expectedEnv = "VARIABLE_ONE=one\n" + "VARIABLE_TWO=2\n"
    const actualEnv = fs.readFileSync(".build/envfile", "utf-8")

    expect(actualEnv).to.eql(expectedEnv)
  })

  it("should exclude reserved environment variables", function() {
    let map = {
      PATH: "one",
      AWS_DEFAULT_PROFILE: "none",
      VARIABLE_TWO: 2,
    }

    dockerEnvGenerator.generateEnvFile(".build/envfile", map)

    const expectedEnv = "VARIABLE_TWO=2\n"
    const actualEnv = fs.readFileSync(".build/envfile", "utf-8")

    expect(actualEnv).to.eql(expectedEnv)
  })
})
