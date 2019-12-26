import { expect } from "chai"
import {
  compileFullDockerMetadataSchema,
  compileUserPropertiesSchema,
  readJsonFileRelative,
  renderValidationMessage, TValidationErrors,
  validateAndCombineFullProps,
} from "./shepherdJson"
import { TDeploymentType, TImageMetadata, TK8sMetadata } from "./index"

describe("shepherd json load and validation", function() {

  describe("user properties", function() {
    it("should validate userprops json", () => {
      const validate = compileUserPropertiesSchema()
      const valid = validate(
        readJsonFileRelative("./testdata/shepherd-json/user-props.json")
      )

      if (validate.errors) {
        if (!valid) console.error("Not valid!", validate.errors)
        expect(validate.errors.length).to.equal(
          0,
          renderValidationMessage(validate as TValidationErrors)
        )
      }
    })

    it("should validate invalid json and output readable messages", () => {
      const validate = compileUserPropertiesSchema()

      validate(
        readJsonFileRelative("./testdata/shepherd-json/user-props-invalid.json")
      )

      if (validate.errors) {
        const expectedError = `\n .someAdditionalField : Not recognized as a valid shepherd metadata property
 .environment : Incorrect type, should be array
 .environment['DB_PASS'] : Incorrect type, should be string
 .environment['DB_PASS'] : Incorrect type, should be null
 .environment['DB_PASS'] : Incorrect value, should match some schema in anyOf
 .hyperlinks[0].url : Incorrect pattern, should match pattern "^https?://"`

        expect(renderValidationMessage(validate as TValidationErrors)).to.equal(expectedError)
      }
    })
  })

  describe("full properties", function() {
    it("should validate generated json metadata ", () => {
      const validate = compileFullDockerMetadataSchema()

      const isValid = validate(
        readJsonFileRelative("./testdata/shepherd-json/full-props.json")
      )

      if (!isValid && validate.errors) {
        expect(renderValidationMessage(validate as TValidationErrors)).to.equal("")
        expect(validate.errors.length).to.equal(0)
      }
    })
  })

  describe("joining of user and generated properties", function() {
    it("should join user and generated props into a single, validated document", () => {
      let generatedPropsFile = "./testdata/shepherd-json/generated-props.json"
      let userPropsFile = "./testdata/shepherd-json/user-props.json"

      const generatedProps = readJsonFileRelative(generatedPropsFile)
      const userProps = readJsonFileRelative(userPropsFile)

      const combinedProps = validateAndCombineFullProps(
        userProps,
        generatedProps
      )

      expect(combinedProps.semanticVersion).to.equal("1.1.1")
      expect(combinedProps.gitBranch).to.equal("master")
    })

    it("should throw an error if one document is invalid", () => {
      let generatedPropsFile = "./testdata/shepherd-json/generated-props.json"
      let userPropsFile = "./testdata/shepherd-json/user-props-invalid.json"

      const generatedProps = readJsonFileRelative(generatedPropsFile)
      const userProps = readJsonFileRelative(userPropsFile)

      try {
        validateAndCombineFullProps(userProps, generatedProps)
        expect.fail("Should have thrown an error")
      } catch (err) {
        expect(err.message).to.contain("someAdditionalField")
      }
    })

    it("should derive deployment type from presence of k8s deployment data", () => {
      let generatedPropsFile = "./testdata/shepherd-json/generated-props.json"
      let userPropsFile = "./testdata/shepherd-json/user-props.json"

      const generatedProps = readJsonFileRelative(generatedPropsFile)
      const userProps = readJsonFileRelative(userPropsFile)

      const combinedProps = validateAndCombineFullProps(
        userProps,
        generatedProps
      ) as TK8sMetadata

      expect(combinedProps.semanticVersion).to.equal("1.1.1")
      expect(combinedProps.gitBranch).to.equal("master")
      expect(combinedProps.deploymentType).to.equal(TDeploymentType.Deployer)
    })
  })

  describe('all supported properties', ()=>{

    let combinedProps: TImageMetadata

    before(()=>{
      let generatedPropsFile = "./testdata/shepherd-json/generated-props.json"
      let userPropsFile = "./testdata/shepherd-json/user-props.json"

      const generatedProps = readJsonFileRelative(generatedPropsFile)
      const userProps = readJsonFileRelative(userPropsFile)

      combinedProps = validateAndCombineFullProps(
        userProps,
        generatedProps,
      )
    })

    it('should parse buildDate from json', ()=>{
      expect(combinedProps.buildDate).to.be.a('string')
    })

    it('should parse buildHostName from json', ()=>{
      expect(combinedProps.buildHostName).to.be.a('string')
    })
    it('should parse deploymentType from json', ()=>{
      expect(combinedProps.deploymentType).to.be.a('string')
    })
    it('should parse displayName from json', ()=>{
      expect(combinedProps.displayName).to.be.a('string')
    })
    it('should parse dockerImageTag from json', ()=>{
      expect(combinedProps.dockerImageTag).to.be.a('string')
    })
    it('should parse e2eTestCommand from json', ()=>{
      expect(combinedProps.end2endTestCommand).to.be.a('string')
    })
    it('should parse gitBranch from json', ()=>{
      expect(combinedProps.gitBranch).to.be.a('string')
    })
    it('should parse gitCommit from json', ()=>{
      expect(combinedProps.gitCommit).to.be.a('string')
    })
    it('should parse gitHash from json', ()=>{
      expect(combinedProps.gitHash).to.be.a('string')
    })
    it('should parse gitUrl from json', ()=>{
      expect(combinedProps.gitUrl).to.be.a('string')
    })
    it('should parse hyperlinks from json', ()=>{
      expect(combinedProps.hyperlinks).to.be.a('Array')
    })
    it('should parse lastCommits from json', ()=>{
      expect(combinedProps.lastCommits).to.be.a('string')
    })
    it('should parse migrationImage from json', ()=>{
      expect(combinedProps.migrationImage).to.be.a('string')
    })
    it('should parse semanticVersion from json', ()=>{
      expect(combinedProps.semanticVersion).to.be.a('string')
    })


  })
})
