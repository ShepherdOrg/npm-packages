import * as agent from "superagent";
import { SuperAgentRequest } from "superagent";

export type TImageWithTags = {
  name:string;
  tags:string[];
}

export type TRegistryImageManifest = {
  schemaVersion:any,
  name:any,
  tag:any,
  architecture:any,
  fsLayers:any,
  history:any,
  signature:any
}

export interface TDockerImageLabels {
  [key: string]: string;
}

export interface IRetrieveDockerImageLabels{
  getImageTags(image:string):Promise<TImageWithTags>
  getImageManifest(image:string, imageTag:string):Promise<TRegistryImageManifest>
  getImageManifestLabels(image: string, imageTag: string): Promise<TDockerImageLabels>;
}

export type TRegistryClientDependencies = {
  agent:any
}

export type TRegistryClientOptions = {
  httpProtocol: string;
  registryHost: string;
  authorization?:{
    type:string
    token: string
  }
}

const defaultDependencies:TRegistryClientDependencies={
  agent:agent
}

export function createDockerRegistryClient(options: TRegistryClientOptions, injected:TRegistryClientDependencies=defaultDependencies): IRetrieveDockerImageLabels{

  function stripHostName(image: string) {
    const len = options.registryHost.length + 1
    return image.slice(len, image.length)
  }

  function addAuthorization(superAgentRequest: SuperAgentRequest) {
    if(options.authorization){
      superAgentRequest.set('Authorization',`${options.authorization.type} ${options.authorization.token}`)
    }
    return superAgentRequest
  }


  function getFromDockerRegistry(ApiUrl: string) {
    return addAuthorization(injected.agent.get(ApiUrl)).set("Host", options.registryHost);
  }

  function getImageManifest(image:string, imageTag:string):Promise<TRegistryImageManifest>{

    return getFromDockerRegistry(`${options.httpProtocol}://${options.registryHost}/v2/${stripHostName(image)}/manifests/${imageTag}`).then((result) => {
      return JSON.parse(result.body);
    });
  }

  function getImageTags(image):Promise<TImageWithTags>{
    return getFromDockerRegistry(`${options.httpProtocol}://${options.registryHost}/v2/${stripHostName(image)}/tags/list/?n=10`).then((result) => {
      return result.body;
    });
  }

  function improveErrorMessage(image: string, imageTag: string) {
    return (err)=>{
      throw new Error(`${image}:${imageTag} ${err.message}`)
    }
  }

  function getImageManifestLabels(image: string, imageTag: string): Promise<TDockerImageLabels>{
    return getImageManifest(image, imageTag).then((imageManifest)=>{
      if(!imageManifest.history[0].v1Compatibility || !imageManifest.history[0].v1Compatibility){
        return {}
      }
      let layerZero = JSON.parse(imageManifest.history[0].v1Compatibility);
      if(!layerZero.config.Labels){
        return {}
      }
      return layerZero.config.Labels;
    }).catch(improveErrorMessage(image, imageTag))
  }

  return {
    getImageManifest,
    getImageTags,
    getImageManifestLabels
  }

}
