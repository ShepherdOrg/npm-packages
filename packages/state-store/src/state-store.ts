import { TStateStoreDependencies } from "./index"
import { TDeploymentState } from "@shepherdorg/metadata/dist"
import fs from "fs"
import path from "path"
import md5File from "md5-file"
import crypto from "crypto"

export function DeploymentDir(operation: string, parameterizedDir:string) {
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

export type TDeploymentStateParams = {
  version: string
  identifier: string
  env: string
  descriptor: string
  operation: string
  origin: string
}

export interface IReleaseStateStore {
  getDeploymentState(deployment:TDeploymentStateParams): Promise<TDeploymentState>
  saveDeploymentState(stateSignatureObject: TDeploymentState ): Promise<TDeploymentState>,
}

export function ReleaseStateStore(injected: TStateStoreDependencies): IReleaseStateStore {
  let storageBackend = injected.storageBackend

  async function getStateSignature(
    env: string,
    deploymentIdentifier: string,
    operation: string,
    deploymentVersion: string,
    newSignature: string
  ) : Promise<TDeploymentState> {

    if(!env){
      throw new Error("Env must be set and be longer than zero")
    }
    if(!deploymentIdentifier){
      throw new Error("Deployment identifier must be set and be longer than zero")
    }

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

  async function saveDeploymentState(stateSignatureObject: TDeploymentState ): Promise<TDeploymentState> {
    if (stateSignatureObject.modified) {
      const timestampedObject = {
        ...stateSignatureObject,
        timestamp: new Date().toISOString(),
      }

      const storedKeyValuePair = await storageBackend.set(
        stateSignatureObject.key,
        // @ts-ignore
        timestampedObject
      )
      return storedKeyValuePair.value
    } else {
      return stateSignatureObject
    }
  }

  return {
    getDeploymentState(deployment:TDeploymentStateParams) {
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
    saveDeploymentState
  }
}
