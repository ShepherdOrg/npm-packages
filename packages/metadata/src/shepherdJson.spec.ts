import { strict as assert } from "node:assert"
import { describe, it, before } from "node:test"
import {
  compileFullDockerMetadataSchema,
  compileUserPropertiesSchema,
  readJsonFileRelative,
  renderValidationMessage, TValidationErrors,
  validateAndCombineFullProps, validateUserShepherdJson,
} from "./shepherdJson"
import { TDeploymentType, TImageMetadata, TK8sMetadata } from "./index"

describe("shepherd json load and validation", function() {

  describe("user properties", function() {
    it("should validate userprops json", () => {
      const validate = compileUserPropertiesSchema()
      const valid = validate(
        readJsonFileRelative("./testdata/shepherd-json/shepherd.json"),
      )

      if (validate.errors) {
        if (!valid) console.error("Not valid!", validate.errors)
        assert.strictEqual(validate.errors.length, 0, renderValidationMessage(validate as TValidationErrors))
      }
    })

    it("should validate invalid json and output readable messages", () => {
      const validate = compileUserPropertiesSchema()

      validate(
        readJsonFileRelative("./testdata/shepherd-json/invalid/shepherd.json"),
      )

      if (validate.errors) {
        const expectedError = `\n .someAdditionalField : Not recognized as a valid shepherd metadata property
 .environment : Incorrect type, should be array
 .environment['DB_PASS'] : Incorrect type, should be string
 .environment['DB_PASS'] : Incorrect type, should be null
 .environment['DB_PASS'] : Incorrect value, should match some schema in anyOf
 .hyperlinks[0].url : Incorrect pattern, should match pattern "^https?://"`

        assert.strictEqual(renderValidationMessage(validate as TValidationErrors), expectedError)
      }
    })
  })

  describe("full properties", function() {
    it("should validate generated json metadata ", () => {
      const validate = compileFullDockerMetadataSchema()

      const isValid = validate(
        readJsonFileRelative("./testdata/shepherd-json/full-props.json"),
      )

      if (!isValid && validate.errors) {
        assert.strictEqual(renderValidationMessage(validate as TValidationErrors), "")
        assert.strictEqual(validate.errors.length, 0)
      }
    })
  })

  describe("joining of user and generated properties", function() {
    it("should join user and generated props into a single, validated document", () => {
      let generatedPropsFile = "./testdata/shepherd-json/generated-props.json"
      let userPropsFile = "./testdata/shepherd-json/shepherd.json"

      const generatedProps = readJsonFileRelative(generatedPropsFile)
      const userProps = readJsonFileRelative(userPropsFile)

      const combinedProps = validateAndCombineFullProps(
        userProps,
        generatedProps,
      )

      assert.strictEqual(combinedProps.semanticVersion, "1.1.1")
      assert.strictEqual(combinedProps.gitBranch, "master")
    })

    it("should throw an error if one document is invalid", () => {
      let generatedPropsFile = "./testdata/shepherd-json/generated-props.json"
      let userPropsFile = "./testdata/shepherd-json/invalid/shepherd.json"

      const generatedProps = readJsonFileRelative(generatedPropsFile)
      const userProps = readJsonFileRelative(userPropsFile)

      try {
        validateAndCombineFullProps(userProps, generatedProps)
        assert.fail("Should have thrown an error")
      } catch (err) {
        assert.ok(err.message.includes("someAdditionalField"))
      }
    })

    it("should derive deployment type from presence of k8s deployment data", () => {
      let generatedPropsFile = "./testdata/shepherd-json/generated-props.json"
      let userPropsFile = "./testdata/shepherd-json/shepherd.json"

      const generatedProps = readJsonFileRelative(generatedPropsFile)
      const userProps = readJsonFileRelative(userPropsFile)

      const combinedProps = validateAndCombineFullProps(
        userProps,
        generatedProps,
      ) as TK8sMetadata

      assert.strictEqual(combinedProps.semanticVersion, "1.1.1")
      assert.strictEqual(combinedProps.gitBranch, "master")
      assert.strictEqual(combinedProps.deploymentType, TDeploymentType.Deployer)
    })

    it("should throw error if no environments in inEnvironments array", () => {
      const userProps = readJsonFileRelative("./testdata/shepherd-json/invalid/missing-preDeploymentTests-inEnvironments.json")
      try {
        validateUserShepherdJson(userProps)
        assert.fail("Should have thrown a validation error")
      } catch (err) {
        assert.ok(err.message.includes(".inEnvironments"))
      }
    })

    it("should throw a more meaningful error if old preDeployTest is set", () => {
      const userProps = readJsonFileRelative("./testdata/shepherd-json/invalid/old-deployment-test-specs-obsolete-shepherd.json")
      try {
        validateUserShepherdJson(userProps)
        assert.fail("Should have thrown a validation error")
      } catch (err) {
        assert.ok(err.message.includes("preDeployTest is no longer supported and has been replaced by preDeploymentTests"))
        assert.ok(err.message.includes("postDeployTest is no longer supported and has been replaced by postDeploymentTests"))
      }

    })
  })


  describe("all supported properties", () => {

    let combinedProps: TImageMetadata

    before(() => {
      let generatedPropsFile = "./testdata/shepherd-json/generated-props.json"
      let userPropsFile = "./testdata/shepherd-json/shepherd.json"

      const generatedProps = readJsonFileRelative(generatedPropsFile)
      const userProps = readJsonFileRelative(userPropsFile)

      combinedProps = validateAndCombineFullProps(
        userProps,
        generatedProps,
      )
    })

    it("should parse buildDate from json", () => {
      assert.strictEqual(typeof combinedProps.buildDate, "string")
    })

    it("should parse buildHostName from json", () => {
      assert.strictEqual(typeof combinedProps.buildHostName, "string")
    })
    it("should parse deploymentType from json", () => {
      assert.strictEqual(typeof combinedProps.deploymentType, "string")
    })
    it("should parse displayName from json", () => {
      assert.strictEqual(typeof combinedProps.displayName, "string")
    })
    it("should parse dockerImageTag from json", () => {
      assert.strictEqual(typeof combinedProps.dockerImageTag, "string")
    })
    it("should parse end2endTestCommand from json", () => {
      assert.strictEqual(typeof combinedProps.end2endTestCommand, "string")
    })
    it("should parse gitBranch from json", () => {
      assert.strictEqual(typeof combinedProps.gitBranch, "string")
    })
    it("should parse gitCommit from json", () => {
      assert.strictEqual(typeof combinedProps.gitCommit, "string")
    })
    it("should parse gitHash from json", () => {
      assert.strictEqual(typeof combinedProps.gitHash, "string")
    })
    it("should parse gitUrl from json", () => {
      assert.strictEqual(typeof combinedProps.gitUrl, "string")
    })
    it("should parse hyperlinks from json", () => {
      assert.ok(Array.isArray(combinedProps.hyperlinks))
    })
    it("should parse lastCommits from json", () => {
      assert.strictEqual(typeof combinedProps.lastCommits, "string")
    })
    it("should parse migrationImage from json", () => {
      assert.strictEqual(typeof combinedProps.migrationImage, "string")
    })

    it("should parse semanticVersion from json", () => {
      assert.strictEqual(typeof combinedProps.semanticVersion, "string")
    })

    it("should parse dockerRegistry from json", () => {
      assert.strictEqual(typeof combinedProps.dockerRegistry, "string")
    })

    it("should parse dockerRepository from json", () => {
      assert.strictEqual(typeof combinedProps.dockerRepository, "string")
    })

    it("should parse preDeploymentTests", () => {
      assert.ok(Array.isArray(combinedProps.preDeploymentTests))
    })

    it("should parse postDeploymentTests", () => {
      assert.ok(Array.isArray(combinedProps.preDeploymentTests))
    })

  })
})
