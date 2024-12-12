import { newProgrammerOops } from "oops-error"
import { TDockerImageHerdDeclarations, THerdFileStructure } from "../deployment-types"
import { TFileSystemPath } from "../helpers/basic-types"
import { parseImageUrl } from "../helpers/parse-image-url"
import { ILog } from "@shepherdorg/logger"

export interface IConfigureUpstreamDeployment {
  origin?: string
  imageFileName?: string
  ttlHours?: number
  upstreamHerdDescription?: string
  upstreamImageTag: string
  upstreamImageName: string
  upstreamHerdKey: string
  branchName?: string

  isUpstreamBranchDeployment(): boolean

  asHerd(): THerdFileStructure

  isUpstreamTriggeredDeployment(): boolean

  herdFileEditNeeded(): boolean

  loadFromEnvironment(herdFilePath: TFileSystemPath, environment: any): void
}

export function createUpstreamTriggerDeploymentConfig(logger: ILog): IConfigureUpstreamDeployment {
  const featureDeploymentConfig: IConfigureUpstreamDeployment = {
    upstreamImageTag: "",
    upstreamImageName: "",
    upstreamHerdKey: "",
    isUpstreamBranchDeployment(): boolean {
      return Boolean(featureDeploymentConfig.branchName)
    },
    asHerd(): THerdFileStructure {
      let images: TDockerImageHerdDeclarations = {}

      if (!featureDeploymentConfig.upstreamHerdKey) {
        throw newProgrammerOops("Cannot construct a herd declaration from upstream config without an upstreamHerdKey")
      }
      let upstreamHerdKey: string = featureDeploymentConfig.upstreamHerdKey
      if (featureDeploymentConfig.isUpstreamBranchDeployment()) {
        images[upstreamHerdKey] = {
          image: featureDeploymentConfig.upstreamImageName,
          imagetag: featureDeploymentConfig.upstreamImageTag,
          description: featureDeploymentConfig.upstreamHerdDescription,
          timeToLiveHours: featureDeploymentConfig.ttlHours,
          featureDeployment: featureDeploymentConfig.isUpstreamBranchDeployment(),
          branchName: featureDeploymentConfig.branchName,
        }
      } else {
        images[upstreamHerdKey] = {
          image: featureDeploymentConfig.upstreamImageName,
          imagetag: featureDeploymentConfig.upstreamImageTag,
          description: featureDeploymentConfig.upstreamHerdDescription,
        }
      }
      return {
        images: images,
      }
    },
    isUpstreamTriggeredDeployment: function(): boolean {
      return Boolean(
        featureDeploymentConfig.upstreamHerdKey &&
          featureDeploymentConfig.upstreamImageName &&
          featureDeploymentConfig.upstreamImageTag
      )
    },
    herdFileEditNeeded(): boolean {
      return Boolean(
        !featureDeploymentConfig.isUpstreamBranchDeployment() && featureDeploymentConfig.isUpstreamTriggeredDeployment()
      )
    },
    loadFromEnvironment(herdFilePath: TFileSystemPath, environment: typeof process.env = process.env): void {
      let upstreamImageUrl: string = ""
      if (environment.UPSTREAM_IMAGE_NAME && environment.UPSTREAM_IMAGE_TAG) {
        upstreamImageUrl = environment.UPSTREAM_IMAGE_NAME + ":" + environment.UPSTREAM_IMAGE_TAG
      } else if (environment.UPSTREAM_IMAGE_URL) {
        upstreamImageUrl = environment.UPSTREAM_IMAGE_URL
      }
      logger.info(
        `Look for the herd up stream. upstreamImageUrl: ${
          environment.UPSTREAM_IMAGE_URL
        }, hasUpstreamHerdKey: ${Boolean(environment.UPSTREAM_HERD_KEY)}`
      )
      if (Boolean(upstreamImageUrl) && environment.UPSTREAM_HERD_KEY) {
        logger.info("Upstream information available, using to modify deployment.")
        const dockerUrl = parseImageUrl(upstreamImageUrl)
        featureDeploymentConfig.imageFileName = herdFilePath
        featureDeploymentConfig.upstreamHerdKey = environment.UPSTREAM_HERD_KEY
        featureDeploymentConfig.upstreamImageName = dockerUrl.imageName
        featureDeploymentConfig.upstreamImageTag = dockerUrl.dockerTag

        featureDeploymentConfig.upstreamHerdDescription = environment.UPSTREAM_HERD_DESCRIPTION
        if (environment.FEATURE_NAME && environment.FEATURE_TTL_HOURS) {
          logger.info(
            "Feature deployment information available, new name: " +
              environment.FEATURE_NAME +
              " to live for " +
              environment.FEATURE_TTL_HOURS +
              " hours"
          )
          featureDeploymentConfig.branchName = environment.FEATURE_NAME.replace(/\//g, "-").toLowerCase()
          featureDeploymentConfig.ttlHours = Number.parseInt(environment.FEATURE_TTL_HOURS, 10)
        }
      }
    },
  }
  return featureDeploymentConfig
}
