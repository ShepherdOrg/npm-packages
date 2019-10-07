import Ajv from 'ajv';

import {expect} from 'chai'

import fs from 'fs'
import path from 'path'

var ajv = new Ajv({schemaId: 'auto'});
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));


function readJsonFile(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(__dirname, relativePath), 'utf-8'))
}

describe.only('shepherd json load and validation', function () {

    it('should validate json', () => {

        const validate = ajv.compile(readJsonFile('./shepherd-json-schema.json'))

        const valid = validate(readJsonFile('./testdata/shepherd-json/allprops.json'))

        if (!valid) console.log("Not valid!", validate.errors);

        if(validate.errors){
            expect(validate.errors.length).to.equal(0)
        }
    });
});
