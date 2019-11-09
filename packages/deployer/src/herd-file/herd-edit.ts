"use strict"

const YAML = require("js-yaml")
const fs = require("fs")

function upgradeOrAddDeployment ({ herd, upstreamHerdKey, upstreamImageTag, upstreamImageName, imageFileName, upstreamHerdDescription }, logger = console) {
  let imglist = herd.images
  let targetImage = imglist[upstreamHerdKey]
  if (targetImage) {
    if (upstreamHerdDescription) {
      targetImage.description = upstreamHerdDescription
    }
    if (targetImage.imagetag !== upstreamImageTag) {
      logger.info(imageFileName + ": Upgrading", upstreamImageName, "version", targetImage.imagetag, "to", upstreamImageTag)
      targetImage.imagetag = upstreamImageTag
    }
  } else {
    logger.info(`Adding ${upstreamHerdKey}->${upstreamImageName}:${upstreamImageTag} to ${imageFileName}`)
    imglist[upstreamHerdKey] = {
      image: upstreamImageName,
      imagetag: upstreamImageTag,
    }
    if (upstreamHerdDescription) {
      imglist[upstreamHerdKey].description = upstreamHerdDescription
    }
  }
  return herd
}

function upgradeOrAddDeploymentInFile ({ imageFileName, upstreamImageName, upstreamImageTag, upstreamHerdKey, upstreamHerdDescription }, logger = console) {
  if (!fs.existsSync(imageFileName)) throw new Error(imageFileName + " does not exist!")
  if (!upstreamHerdKey) throw new Error("upstreamHerdKey parameter must have a value")
  if (!upstreamImageName) throw new Error("upstreamImageName parameter must have a value")
  if (!upstreamImageTag) throw new Error("upstreamImageTag parameter must have a value")

  let herd = YAML.safeLoad(fs.readFileSync(imageFileName, "utf8"))

  if (!herd) {
    throw new Error(imageFileName + " does not seem to contain a legal herd file")
  }
  herd = upgradeOrAddDeployment({
    herd,
    upstreamHerdKey,
    upstreamImageTag,
    upstreamImageName,
    imageFileName,
    upstreamHerdDescription,
  }, logger)

  let yml = YAML.safeDump(herd)
  let file = fs.openSync(imageFileName, "w+")
  fs.writeSync(file, yml)
  fs.closeSync(file)
}

module.exports = {
  upgradeOrAddDeploymentInFile,
  upgradeOrAddDeployment,
}
