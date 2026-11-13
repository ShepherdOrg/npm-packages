import * as http from "http"
import * as https from "https"

export type TRequestOptions = {
  method?: string
  url: string
  headers?: { [key: string]: string }
  ca?: string
}

export class RegistryRequestError extends Error {
  statusCode?: number
  error: any

  constructor(message: string, statusCode?: number, error?: any) {
    super(message)
    this.statusCode = statusCode
    this.error = error
  }
}

/**
 * Minimal promise based http client. Resolves with the response body for 2xx responses and
 * rejects with a RegistryRequestError (carrying statusCode and body) otherwise.
 */
function request(options: TRequestOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(options.url)
    const client = url.protocol === "https:" ? https : http
    const req = client.request(
      url,
      { method: options.method || "GET", headers: options.headers, ca: options.ca },
      res => {
        const chunks: Buffer[] = []
        res.on("data", chunk => chunks.push(chunk))
        res.on("error", reject)
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8")
          const statusCode = res.statusCode || 0
          if (statusCode >= 200 && statusCode < 300) {
            resolve(body)
          } else {
            reject(new RegistryRequestError(`${statusCode} - ${body}`, statusCode, body))
          }
        })
      },
    )
    req.on("error", err => reject(new RegistryRequestError(err.message, undefined, err.message)))
    req.end()
  })
}

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

  verifyVersion(version: string): Promise<boolean>

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

  async function verifyVersion(versionStr):Promise<boolean>{
    let versionCheckResult = await getFromDockerRegistry(`${options.httpProtocol}://${options.registryHost}/${versionStr}`)
    return Boolean(versionCheckResult )
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

    verifyVersion
  }
}
