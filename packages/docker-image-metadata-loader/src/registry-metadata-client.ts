import * as request from "request-promise"

export type TImageWithTags = {
  name: string
  tags: string[]
}

export type TRegistryImageManifest = {
  schemaVersion: any
  name: any
  tag: any
  architecture: any
  fsLayers: any
  history: any
  signature: any
}

export interface TDockerImageLabels {
  [key: string]: string
}

export interface IRetrieveDockerImageLabels {
  getImageTags(image: string): Promise<TImageWithTags>

  getImageManifest(
    image: string,
    imageTag: string,
  ): Promise<TRegistryImageManifest>

  getImageManifestLabels(
    image: string,
    imageTag: string,
  ): Promise<TDockerImageLabels>

  addCertificate(caCrt: string)

  getCertificate(): string | undefined
}

export type TRegistryClientDependencies = {
  request: any
}

export type TRegistryClientOptions = {
  httpProtocol: string
  registryHost: string
  authorization?: {
    type: string
    token: string
  },
  ca?: string
}

const defaultDependencies: TRegistryClientDependencies = {
  request: request,
}


export function createDockerRegistryClient(
  options: TRegistryClientOptions,
  injected: TRegistryClientDependencies = defaultDependencies,
): IRetrieveDockerImageLabels {
  function stripHostName(image: string) {
    const len = options.registryHost.length + 1
    return image.slice(len, image.length)
  }

  function addCertificateOptions(requestOptions) {
    if (options.ca) {
      return {
        ...requestOptions,
        ca: options.ca,
      }
    } else {
      return requestOptions
    }
  }

  function addAuthorization(request: any) {
    if (options.authorization) {
      return {
        ...request,
        headers: {
          "Authorization":
            `${options.authorization.type} ${options.authorization.token}`,
        },
      }
    } else{
      return request
    }
  }

  function getFromDockerRegistry(ApiUrl: string) {
    let requestOptions = addCertificateOptions(addAuthorization({
        method: "GET",
        url: ApiUrl,
      },
    ))
    return injected.request(requestOptions)
  }

  function getImageManifest(
    image: string,
    imageTag: string,
  ): Promise<TRegistryImageManifest> {
    return getFromDockerRegistry(
      `${options.httpProtocol}://${options.registryHost}/v2/${stripHostName(
        image,
      )}/manifests/${imageTag}`,
    ).then(resultBody => {
      return JSON.parse(resultBody)
    }).catch((err) => {
      // console.log('ERROROR', err)
      improveErrorMessage(image, imageTag)(err)
    })
  }

  function getImageTags(image): Promise<TImageWithTags> {
    return getFromDockerRegistry(
      `${options.httpProtocol}://${options.registryHost}/v2/${stripHostName(
        image,
      )}/tags/list/?n=10`,
    ).then(result => {
      return JSON.parse(result)
    })
  }

  function improveErrorMessage(image: string, imageTag: string) {
    return err => {
      throw new Error(`${image}:${imageTag} ${err.statusCode || ""}: ${err.error}`)
    }
  }

  function addCertificate(caCrt: string) {
    options.ca = caCrt
  }

  function getImageManifestLabels(
    image: string,
    imageTag: string,
  ): Promise<TDockerImageLabels> {
    return getImageManifest(image, imageTag)
      .then(imageManifest => {
        if (
          !imageManifest.history[0].v1Compatibility ||
          !imageManifest.history[0].v1Compatibility
        ) {
          return {}
        }
        let layerZero = JSON.parse(imageManifest.history[0].v1Compatibility)
        if (!layerZero.config.Labels) {
          return {}
        }
        return layerZero.config.Labels
      })
  }

  function getCertificate(): string | undefined {
    return options.ca
  }

  return {
    getImageManifest,
    getImageTags,
    getImageManifestLabels,
    addCertificate,
    getCertificate,

  }
}
