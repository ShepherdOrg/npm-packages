import { TStateStoreDependencies } from "./index"
import { TDeploymentState } from "@shepherdorg/metadata/dist"
import fs from "fs"
import path from "path"
import md5File from "md5-file"
import crypto from "crypto"

export function DeploymentDir(operation, parameterizedDir) {
  if (!parameterizedDir) {
    throw new Error("Directory parameter is mandatory! ")
  }
  let isADirectory = fs.lstatSync(parameterizedDir).isDirectory()
  if (!isADirectory) {
    throw new Error(parameterizedDir + " is not a directory")
  }

  return {
    signature() {
      const files = fs.readdirSync(parameterizedDir)
      const aggregatedSignatures = files.reduce(
        (signature, file) =>
          signature + md5File.sync(path.join(parameterizedDir, file)),
        ""
      )

      return crypto
        .createHash("md5")
        .update(operation + aggregatedSignatures)
        .digest("hex")
    },
  }
}

export function ReleaseStateStore(injected: TStateStoreDependencies) {
  let storageBackend = injected.storageBackend

  async function getStateSignature(
    env: string,
    deploymentIdentifier: string,
    operation: string,
    deploymentVersion: string,
    newSignature: string
  ) {
    const envIdentifier = `${env}-${deploymentIdentifier}`
    const keyValue = await storageBackend.get(envIdentifier)

    const existingState = keyValue.value
    const newState: TDeploymentState = {
      key: envIdentifier,
      new: true,
      modified: true,
      operation: operation,
      version: deploymentVersion,
      lastVersion: undefined,
      signature: newSignature,
      env: env,
    }
    if (existingState) {
      newState.new = false
      newState.lastVersion = existingState.version
      newState.modified =
        operation !== existingState.operation ||
        existingState.signature !== newSignature ||
        existingState.version !== deploymentVersion
    }

    return newState
  }

  async function saveDeploymentState(stateSignatureObject) {
    if (stateSignatureObject.modified) {
      const timestampedObject = {
        ...stateSignatureObject,
        timestamp: new Date().toISOString(),
      }

      const storedKeyValuePair = await storageBackend.set(
        stateSignatureObject.key,
        timestampedObject
      )
      return storedKeyValuePair.value
    } else {
      return stateSignatureObject
    }
  }

  return {
    getDeploymentState(deployment) {
      let deploymentSignature = crypto
        .createHash("md5")
        .update(deployment.operation + deployment.descriptor)
        .digest("hex")
      return getStateSignature(
        deployment.env,
        deployment.identifier,
        deployment.operation,
        deployment.version,
        deploymentSignature
      )
    },
    saveDeploymentState,
    storeDeploymentDirState(deployment) {
      let deploymentSignature = DeploymentDir(
        deployment.operation,
        deployment.directory
      ).signature()
      return getStateSignature(
        deployment.env,
        deployment.identifier,
        deployment.operation,
        deployment.version,
        deploymentSignature
      ).then(saveDeploymentState)
    },
  }
}
