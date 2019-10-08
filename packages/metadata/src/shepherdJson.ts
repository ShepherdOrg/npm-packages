import Ajv from 'ajv'
import fs from "fs"
import path from "path"


export function readJsonFile(absolutePath) {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf-8'))
}

export function readJsonFileRelative(relativePath) {
    return readJsonFile(path.join(__dirname, relativePath))
}

export function renderValidationMessage(validate) {
    function renderValidationError(validationError: any) {
        const keywordRenderers = {
            "additionalProperties": (validationErr: any) => {
                return `.${validationErr.params.additionalProperty} : Not recognized as a valid shepherd metadata property`
            },
            "required": (validationErr: any) => {
                return `.${validationErr.params.missingProperty} : Must be specified`
            },
            "type": (validationErr: any) => {
                return `${validationErr.dataPath} : Incorrect type, ${validationErr.message}`
            },
            "pattern": (validationErr: any) => {
                return `${validationErr.dataPath} : Incorrect pattern, ${validationErr.message}`
            },
            "anyOf": (validationErr: any) => {
                return `${validationErr.dataPath} : Incorrect value, ${validationErr.message}`
            }
        }

        if (keywordRenderers[validationError.keyword]) {
            return keywordRenderers[validationError.keyword](validationError)
        } else {
            return validationError.message + '- JSON:' + JSON.stringify(validationError)
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
    extendedSchema.$id += 'extended'
    return extendedSchema
}

export function compileFullDockerMetadataSchema() {
    const ajv = new Ajv({schemaId: 'auto', allErrors: true});
    ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));

    let baseSchema = readJsonFileRelative('./shepherd-docker-metadata.schema.json')
    let extendingSchema = readJsonFileRelative('./shepherd-generated-docker-metadata.schema.json')

    let extendedSchema = extendJsonSchema(baseSchema, extendingSchema)
    return ajv.compile(extendedSchema)
}

export function compileUserPropertiesSchema() {
    const ajv = new Ajv({schemaId: 'auto', allErrors: true});
    ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));
    let minimalSchema = readJsonFileRelative('./shepherd-docker-metadata.schema.json')
    return ajv.compile(minimalSchema)
}

function compileGeneratedPropertiesSchema() {
    const ajv = new Ajv({schemaId: 'auto', allErrors: true});
    ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));
    let schema = readJsonFileRelative('./shepherd-generated-docker-metadata.schema.json')
    return ajv.compile(schema)
}

export function validateAndCombineFullProps(userProps, generatedProps) {
    const validateUserProps = compileUserPropertiesSchema()

    validateUserProps(userProps)
    if (validateUserProps.errors) {
        throw new Error(`User properties did not pass validation: ${renderValidationMessage(validateUserProps)}`)
    }

    const validateGeneratedProps = compileGeneratedPropertiesSchema()
    validateUserProps(generatedProps)
    if (validateGeneratedProps.errors) {
        throw new Error(`Generated properties did not pass validation: ${renderValidationMessage(validateGeneratedProps)}`)
    }

    return Object.assign({}, generatedProps, userProps)
}
