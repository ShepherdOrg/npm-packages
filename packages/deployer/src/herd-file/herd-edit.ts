"use strict"

import { TFileSystemPath } from "../helpers/basic-types"
import * as fs from "fs"
import { TDockerImageHerdDeclaration } from "../deployment-types"
import * as chalk from "chalk"

import * as yaml from "js-yaml"


export type THerdImagesSpec = {
  images: { [key: string]: Omit<TDockerImageHerdDeclaration, "key"> }
}

export type TDeploymentUpgradeParamsFromLoadedHerd = TDeploymentUpgradeParams & {
  herd: THerdImagesSpec
}

export type TDeploymentUpgradeParams = {
  imageFileName: TFileSystemPath
  upstreamImageName: string
  upstreamImageTag: string
  upstreamHerdKey: string
  upstreamHerdDescription: string
}

export function upgradeOrAddDeployment(
  {
    herd,
    upstreamHerdKey,
    upstreamImageTag,
    upstreamImageName,
    imageFileName,
    upstreamHerdDescription,
  }: TDeploymentUpgradeParamsFromLoadedHerd,
  logger = console
) {
  let imglist = herd.images
  let targetImage = imglist[upstreamHerdKey]
  if (targetImage) {
    if (upstreamHerdDescription) {
      targetImage.description = upstreamHerdDescription
    }
    if (targetImage.imagetag !== upstreamImageTag) {
      logger.info(
        imageFileName + ": Upgrading",
        upstreamImageName,
        "version",
        targetImage.imagetag,
        "to",
        upstreamImageTag
      )
      targetImage.imagetag = upstreamImageTag
    }
    if (targetImage.image !== upstreamImageName) {
      logger.info(
        imageFileName + ": Changing",
        targetImage.image,
        " image url",
        "to",
        upstreamImageName
      )
      targetImage.image = upstreamImageName
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

/* istanbul ignore next */
export function upgradeOrAddDeploymentInFile(
  {
    imageFileName,
    upstreamImageName,
    upstreamImageTag,
    upstreamHerdKey,
    upstreamHerdDescription,
  }: TDeploymentUpgradeParams,
  logger = console
) {
  if (!fs.existsSync(imageFileName)) throw new Error(chalk.red(imageFileName) + " does not exist!")
  if (!upstreamHerdKey) throw new Error("upstreamHerdKey parameter must have a value")
  if (!upstreamImageName) throw new Error("upstreamImageName parameter must have a value")
  if (!upstreamImageTag) throw new Error("upstreamImageTag parameter must have a value")

  let herd = yaml.safeLoad(fs.readFileSync(imageFileName, "utf8"))

  if (!herd) {
    throw new Error(imageFileName + " does not seem to contain a legal herd file")
  }
  herd = upgradeOrAddDeployment(
    {
      herd,
      upstreamHerdKey,
      upstreamImageTag,
      upstreamImageName,
      imageFileName,
      upstreamHerdDescription,
    },
    logger
  )

  let yml = yaml.safeDump(herd)
  let file = fs.openSync(imageFileName, "w+")
  fs.writeSync(file, yml)
  fs.closeSync(file)
}

