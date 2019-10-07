import Ajv from 'ajv';

import {expect} from 'chai'

import fs from 'fs'
import path from 'path'

var ajv = new Ajv({schemaId: 'auto', allErrors: true});

ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));


function readJsonFile(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(__dirname, relativePath), 'utf-8'))
}

function renderValidationMessage(validate) {
    function renderValidationError(validationError: any) {
        const keywordRenderers={
            "additionalProperties":(validationErr:any)=>{
                return `.${Object.getOwnPropertyNames(validationErr.params).join(',')} : Not recognized as a valid shepherd metadata property`
            },
            "required":(validationErr:any)=>{
                return `.${validationErr.params.missingProperty} : Must be specified`
            },
            "type":(validationErr:any)=>{
                return `${validationErr.dataPath} : Incorrect type, ${validationErr.message}`
            },
            "pattern":(validationErr:any)=>{
                console.log(JSON.stringify(validationErr))
                return `${validationErr.dataPath} : Incorrect pattern, ${validationErr.message}`
            },
            "anyOf":(validationErr:any)=>{
                console.log(JSON.stringify(validationErr))
                return `${validationErr.dataPath} : Incorrect value, ${validationErr.message}`
            }
        }

        if(keywordRenderers[validationError.keyword]){
            return keywordRenderers[validationError.keyword](validationError)
        } else{
            return validationError.message + '--------' + JSON.stringify(validationError)
        }

    }

    // return JSON.stringify(validate.errors);
    return validate.errors.reduce((prevValue, currentValue) => {
        return `${prevValue}\n ${renderValidationError(currentValue)}`
    }, "")
}

function extendJsonSchema(baseSchema, extendingSchema) {
    let extendedSchema = Object.assign({}, extendingSchema);
    extendedSchema.properties = Object.assign(extendedSchema.properties, baseSchema.properties)
    extendedSchema.required = extendedSchema.required.concat(baseSchema.required)
    return extendedSchema
}

function compileGeneratedDockerMetadataSchema() {
    let baseSchema = readJsonFile('./shepherd-docker-metadata.schema.json')
    let extendingSchema = readJsonFile('./shepherd-generated-docker-metadata.schema.json')

    let extendedSchema = extendJsonSchema(baseSchema, extendingSchema)
    return ajv.compile(extendedSchema)
}

function compileUserPropertiesSchema() {
    let minimalSchema = readJsonFile('./shepherd-docker-metadata.schema.json')
    const validate = ajv.compile(minimalSchema)
    return validate
}

describe('shepherd json load and validation', function () {

    describe('user properties', function () {
        it('should validate userprops json', () => {
            const validate = compileUserPropertiesSchema()
            const valid = validate(readJsonFile('./testdata/shepherd-json/user-props.json'))

            if (validate.errors) {
                if (!valid) console.log("Not valid!", validate.errors);
                expect(validate.errors.length).to.equal(0)
            }
        });

        it('should validate invalid json and output readable messages', () => {

            const validate = compileUserPropertiesSchema()

            validate(readJsonFile('./testdata/shepherd-json/user-props-invalid.json'))

            if (validate.errors) {
                const expectedError= `\n .additionalProperty : Not recognized as a valid shepherd metadata property
 .version : Must be specified
 .isDbMigration : Incorrect type, should be boolean
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

            const validate = compileGeneratedDockerMetadataSchema()

            const valid = validate(readJsonFile('./testdata/shepherd-json/generated-props.json'))

            if (!valid && validate.errors) {
                expect(renderValidationMessage(validate)).to.equal('')
                expect(validate.errors.length).to.equal(0)
            }
        });
    });

});
