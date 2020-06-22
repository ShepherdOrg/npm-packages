import { TK8sPartialDescriptor } from "./k8s-document-types"

import * as yaml from "js-yaml"

export type TDescriptorsByKind = {
  [key: string] : Array<TK8sPartialDescriptor>
}

export function identifyDocument(deploymentDocument:string):{identifyingString:string, descriptorsByKind:TDescriptorsByKind} {
  try {
    let descriptorsByKind:TDescriptorsByKind = {}

    let documentKind:string=""

    yaml.safeLoadAll(deploymentDocument, (documentPart:TK8sPartialDescriptor)=>{
      if(!documentPart){

        return
      }
      let documentPartKind:string = documentPart.kind
      if(!documentKind){
        documentKind = documentPartKind
        if (documentPart.metadata) {
          documentKind += "_" + documentPart.metadata.name

          if (
            documentPart.metadata.namespace &&
            documentPart.metadata.namespace !== "default"
          ) {
            documentKind =
              documentPart.metadata.namespace + "_" + documentKind
          }
        }
      }
      descriptorsByKind[documentPartKind] = descriptorsByKind[documentPartKind] || []
      descriptorsByKind[documentPartKind].push( documentPart)
    })

    return {identifyingString: documentKind, descriptorsByKind }
  } catch (e) {
    console.error(deploymentDocument)
    console.error("Error classifying deployment document (see above).", e)
    process.exit(255)
  }
}
