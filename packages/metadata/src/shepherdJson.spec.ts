import {expect} from 'chai'
import {
    compileFullDockerMetadataSchema,
    compileUserPropertiesSchema,
    readJsonFileRelative,
    renderValidationMessage,
    validateAndCombineFullProps
} from './shepherdJson'


describe('shepherd json load and validation', function () {

    describe('user properties', function () {
        it('should validate userprops json', () => {
            const validate = compileUserPropertiesSchema()
            const valid = validate(readJsonFileRelative('./testdata/shepherd-json/user-props.json'))

            if (validate.errors) {
                if (!valid) console.log("Not valid!", validate.errors);
                expect(validate.errors.length).to.equal(0, renderValidationMessage(validate))
            }
        });

        it('should validate invalid json and output readable messages', () => {

            const validate = compileUserPropertiesSchema()

            validate(readJsonFileRelative('./testdata/shepherd-json/user-props-invalid.json'))

            if (validate.errors) {
                const expectedError= `\n .someAdditionalField : Not recognized as a valid shepherd metadata property
 .environment['DB_PASS'] : Incorrect type, should be string
 .environment['DB_PASS'] : Incorrect type, should be null
 .environment['DB_PASS'] : Incorrect value, should match some schema in anyOf
 .hyperlinks[0].url : Incorrect pattern, should match pattern "^https?://"`

                expect(renderValidationMessage(validate)).to.equal(expectedError)
            }
        });

    });


    describe('full properties', function () {
        it('should validate generated json metadata ', () => {

            const validate = compileFullDockerMetadataSchema()

            const valid = validate(readJsonFileRelative('./testdata/shepherd-json/full-props.json'))

            if (!valid && validate.errors) {
                expect(renderValidationMessage(validate)).to.equal('')
                expect(validate.errors.length).to.equal(0)
            }
        });
    });

    describe('joining of user and generated properties', function () {

        it('should join user and generated props into a single, validated document', () => {

            let generatedPropsFile = './testdata/shepherd-json/generated-props.json'
            let userPropsFile = './testdata/shepherd-json/user-props.json'

            const generatedProps = readJsonFileRelative(generatedPropsFile)
            const userProps = readJsonFileRelative(userPropsFile)

            const combinedProps = validateAndCombineFullProps(userProps, generatedProps)

            expect(combinedProps.semanticVersion).to.equal('1.1.1')
            expect(combinedProps.gitBranch).to.equal('master')
        });

        it('should throw an error if one document is invalid', () => {

            let generatedPropsFile = './testdata/shepherd-json/generated-props.json'
            let userPropsFile = './testdata/shepherd-json/user-props-invalid.json'

            const generatedProps = readJsonFileRelative(generatedPropsFile)
            const userProps = readJsonFileRelative(userPropsFile)

            try{
                validateAndCombineFullProps(userProps, generatedProps)
                expect.fail('Should have thrown an error')
            }catch(err){
                expect(err.message).to.contain('someAdditionalField')
            }

        });

    });

});
