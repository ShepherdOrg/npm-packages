#!/usr/bin/env node

import {inspectAndExtractShepherdMetadata} from './shepherd-inspect'

let dockerImageReference = process.argv[2]

if(!dockerImageReference || process.argv.indexOf('--help') > 0){
    console.log(`
Inspect shepherd metadata for a docker image.

Usage:
${process.argv[1]}  <DockerImageReference>     

Example:

${process.argv[1]} shepherdorg/shepherd:latest     
    `)
    process.exit(1)
}

inspectAndExtractShepherdMetadata(dockerImageReference).then((shepherdMetadata)=>{
    console.log(shepherdMetadata)
})
