export type TDockerImageUrl = string

export type TDockerImageUrlStruct ={

  /**  Legecy field name, for backwards compatibility. Same as dockerRegistry/dockerRepository */
  imageName: string
  /**  Legecy field name, for backwards compatibility. Same as dockerRepository */
  image: string
  /**  Legecy field name, for backwards compatibility. Same as dockerTag */
  imagetag: string
  dockerNamespace: string | null
  dockerRepository: string
  dockerRegistry: string | null
  dockerTag: string
  originalUrl: TDockerImageUrl
}

export function parseImageUrl(imageUrl:TDockerImageUrl): TDockerImageUrlStruct {
  let match = imageUrl.match(/^(?:([^\/]+)\/)?(?:([^\/]+)\/)?([^@:\/]+)(?:[@:](.+))?$/)
  if (!match) throw new Error(`${imageUrl} is not a valid docker image URL!`)

  let dockerRegistry : string = match[1] || ""
  let dockerNamespace = match[2] || ""
  let dockerRepository = match[3]
  let dockerTag = match[4] || "latest"

  if (!dockerNamespace && dockerRegistry && !/[:.]/.test(dockerRegistry)) {
    dockerNamespace = dockerRegistry
  }
  dockerNamespace = dockerNamespace && dockerNamespace !== 'library' ? dockerNamespace+'/' : ''

  const imageName = `${dockerRegistry? dockerRegistry + '/':''}${dockerRepository}`
  return {
    dockerNamespace,
    dockerRepository,
    dockerRegistry,
    dockerTag,
    imageName,
    imagetag: dockerTag,
    image: dockerRepository,
    originalUrl: imageUrl
  }
}
