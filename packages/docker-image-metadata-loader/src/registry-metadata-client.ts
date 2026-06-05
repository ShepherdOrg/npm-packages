import * as https from "https"
import * as http from "http"
import { URL } from "url"

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

export type THttpResponse = {
  status: number
  body: string
}

export type THttpGetOptions = {
  url: string
  headers?: { [key: string]: string }
  ca?: string
}

export type THttpGet = (options: THttpGetOptions) => Promise<THttpResponse>

export type TRegistryClientDependencies = {
  httpGet: THttpGet
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

const defaultHttpGet: THttpGet = ({ url, headers, ca }) => {
  const parsed = new URL(url)
  const isHttps = parsed.protocol === "https:"
  const lib = isHttps ? https : http
  const requestOptions: https.RequestOptions = {
    method: "GET",
    hostname: parsed.hostname,
    port: parsed.port || (isHttps ? 443 : 80),
    path: `${parsed.pathname}${parsed.search}`,
    headers,
  }
  if (isHttps && ca) {
    requestOptions.ca = ca
  }
  return new Promise((resolve, reject) => {
    const req = lib.request(requestOptions, res => {
      const chunks: Buffer[] = []
      res.on("data", chunk => chunks.push(Buffer.from(chunk)))
      res.on("end", () => {
        resolve({
          status: res.statusCode || 0,
          body: Buffer.concat(chunks).toString("utf8"),
        })
      })
      res.on("error", reject)
    })
    req.on("error", reject)
    req.end()
  })
}

const defaultDependencies: TRegistryClientDependencies = {
  httpGet: defaultHttpGet,
}

class RegistryRequestError extends Error {
  statusCode: number
  error: string

  constructor(statusCode: number, body: string) {
    super(`${statusCode}: ${body}`)
    this.statusCode = statusCode
    this.error = body
  }
}


export function createDockerRegistryClient(
  options: TRegistryClientOptions,
  injected: TRegistryClientDependencies = defaultDependencies,
): IRetrieveDockerImageLabels {
  function stripHostName(image: string) {
    const len = options.registryHost.length + 1
    return image.slice(len, image.length)
  }

  function buildHeaders(): { [key: string]: string } | undefined {
    if (!options.authorization) {
      return undefined
    }
    return {
      Authorization: `${options.authorization.type} ${options.authorization.token}`,
    }
  }

  async function getFromDockerRegistry(apiUrl: string): Promise<string> {
    const response = await injected.httpGet({
      url: apiUrl,
      headers: buildHeaders(),
      ca: options.ca,
    })
    if (response.status < 200 || response.status >= 300) {
      throw new RegistryRequestError(response.status, response.body)
    }
    return response.body
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
