import { newProgrammerOops } from "oops-error"
import { ILog, OmitKey, TDockerImageHerdSpec } from "./deployment-types"
import { TFileSystemPath } from "../basic-types"

type TDockerImageHerdSpecs = { [imageKey: string]: OmitKey<TDockerImageHerdSpec> }

export type THerdFileStructure = {
  infrastructure?: {}
  images?: TDockerImageHerdSpecs
}

export interface TFeatureDeploymentConfig {
  origin?: string
  imageFileName?: string
  ttlHours?: number
  upstreamHerdDescription?: string
  upstreamImageTag: string
  upstreamImageName: string
  upstreamHerdKey: string
  branchName?: string

  isUpstreamFeatureDeployment(): boolean

  asHerd(): THerdFileStructure

  isUpstreamTriggeredDeployment(): boolean

  herdFileEditNeeded(): boolean

  loadFromEnvironment(herdFilePath: TFileSystemPath, environment: any): void
}


export function CreateUpstreamTriggerDeploymentConfig(logger: ILog): TFeatureDeploymentConfig {
  const featureDeploymentConfig: TFeatureDeploymentConfig = {
    upstreamImageTag: "",
    upstreamImageName: "",
    upstreamHerdKey: "",
    isUpstreamFeatureDeployment():boolean {
      return Boolean(featureDeploymentConfig.branchName)
    },
    asHerd():THerdFileStructure {
      let images: TDockerImageHerdSpecs = {}

      if (!featureDeploymentConfig.isUpstreamFeatureDeployment()) {
        throw new Error(
          "Upstream config does not contain enough information for upstream feature deployment configuration!",
        )
      }
      if (!featureDeploymentConfig.upstreamHerdKey) {
        throw newProgrammerOops("Cannot construct a herd declaration from upstream config without an upstreamHerdKey")
      }
      let upstreamHerdKey: string = featureDeploymentConfig.upstreamHerdKey
      images[upstreamHerdKey] = {
        image: featureDeploymentConfig.upstreamImageName,
        imagetag: featureDeploymentConfig.upstreamImageTag,
        description: featureDeploymentConfig.upstreamHerdDescription,
        timeToLiveHours: featureDeploymentConfig.ttlHours,
        featureDeployment: true,
        branchName: featureDeploymentConfig.branchName,
      }
      return {
        images: images,
      }
    },
    isUpstreamTriggeredDeployment: function(): boolean {
      return Boolean(featureDeploymentConfig.upstreamHerdKey &&
        featureDeploymentConfig.upstreamImageName &&
        featureDeploymentConfig.upstreamImageTag)

    },
    herdFileEditNeeded(): boolean {
      return Boolean(!featureDeploymentConfig.isUpstreamFeatureDeployment() && featureDeploymentConfig.isUpstreamTriggeredDeployment())
    },
    loadFromEnvironment(herdFilePath: TFileSystemPath, environment: typeof process.env = process.env): void {
      if (environment.UPSTREAM_IMAGE_NAME && environment.UPSTREAM_IMAGE_TAG && environment.UPSTREAM_HERD_KEY) {
        logger.info("Upstream information available, using to modify deployment.")
        featureDeploymentConfig.imageFileName = herdFilePath
        featureDeploymentConfig.upstreamHerdKey = environment.UPSTREAM_HERD_KEY
        featureDeploymentConfig.upstreamImageName = environment.UPSTREAM_IMAGE_NAME
        featureDeploymentConfig.upstreamImageTag = environment.UPSTREAM_IMAGE_TAG
        featureDeploymentConfig.upstreamHerdDescription = environment.UPSTREAM_HERD_DESCRIPTION
        if (environment.FEATURE_NAME && environment.FEATURE_TTL_HOURS) {
          logger.info("Feature deployment information available, new name: " + environment.FEATURE_NAME + " to live for " + environment.FEATURE_TTL_HOURS + " hours")
          featureDeploymentConfig.branchName = environment.FEATURE_NAME.replace(/\//g, "-").toLowerCase()
          featureDeploymentConfig.ttlHours = Number.parseInt(environment.FEATURE_TTL_HOURS, 10)
        }
      }
    },
  }
  return featureDeploymentConfig
}

