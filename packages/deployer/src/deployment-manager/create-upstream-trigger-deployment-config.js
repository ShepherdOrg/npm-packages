function CreateUpstreamTriggerDeploymentConfig(logger) {
  const featureDeploymentConfig = {
    isUpstreamFeatureDeployment() {
      return Boolean(featureDeploymentConfig.newName)
    },
    asHerd() {
      let images = {}
      if (!featureDeploymentConfig.isUpstreamFeatureDeployment()) {
        throw new Error(
          "Upstream config does not contain enough information for upstream feature deployment configuration!"
        )
      }
      images[featureDeploymentConfig.upstreamHerdKey] = {
        image: featureDeploymentConfig.upstreamImageName,
        imagetag: featureDeploymentConfig.upstreamImageTag,
        description: featureDeploymentConfig.upstreamHerdDescription,
        timeToLiveHours: featureDeploymentConfig.ttlHours,
      }
      return {
        images: images,
      }
    },
    isUpstreamTriggeredDeployment: function() {
      return (
        featureDeploymentConfig.upstreamHerdKey &&
        featureDeploymentConfig.upstreamImageName &&
        featureDeploymentConfig.upstreamImageTag
      )
    },
    herdFileEditNeeded() {
      return Boolean(!featureDeploymentConfig.isUpstreamFeatureDeployment() && this.isUpstreamTriggeredDeployment())
    },
    loadFromEnvironment(herdFilePath, environment = process.env) {
      if (environment.UPSTREAM_IMAGE_NAME && environment.UPSTREAM_IMAGE_TAG && environment.UPSTREAM_HERD_KEY) {
        logger.info("Upstream information available, using to modify deployment.")
        featureDeploymentConfig.imageFileName = herdFilePath
        featureDeploymentConfig.upstreamHerdKey = environment.UPSTREAM_HERD_KEY
        featureDeploymentConfig.upstreamImageName = environment.UPSTREAM_IMAGE_NAME
        featureDeploymentConfig.upstreamImageTag = environment.UPSTREAM_IMAGE_TAG
        featureDeploymentConfig.upstreamHerdDescription = environment.UPSTREAM_HERD_DESCRIPTION
        if (environment.FEATURE_NAME && environment.FEATURE_TTL_HOURS) {
          logger.info("Feature deployment information available, new name: " + environment.FEATURE_NAME + " to live for " + environment.FEATURE_TTL_HOURS + " hours")
          featureDeploymentConfig.upstreamFeatureDeployment = true
          featureDeploymentConfig.newName = environment.FEATURE_NAME.replace(/\//g, "-").toLowerCase()
          featureDeploymentConfig.ttlHours = Number.parseInt(environment.FEATURE_TTL_HOURS, 10)
        }
      }
    },
  }
  return featureDeploymentConfig
}

module.exports = {
  CreateUpstreamTriggerDeploymentConfig: CreateUpstreamTriggerDeploymentConfig,
}
