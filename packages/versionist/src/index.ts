import * as path from "path"
import * as fs from "fs"

export function asBashExports(dirVersion: TDirVersion) {

  let imageUrl = `${dirVersion.dockerRegistry ? dirVersion.dockerRegistry + "/" : ""}${dirVersion.dockerRegistryOrganization + "/" || ""}${preferredName(dirVersion)}`

  return `export IMAGE_URL=${imageUrl}
export DOCKER_IMAGE=${imageUrl}:${preferredVersion(dirVersion)}
export DOCKER_IMAGE_LATEST_TAG=${imageUrl}:latest
export DOCKER_IMAGE_GITHASH_TAG=${imageUrl}:${dirVersion.dirHash}
export DOCKER_IMAGE_BRANCH_HASH_TAG=${imageUrl}:${dirVersion.branchName}-${dirVersion.dirHash}
`
}

const shellExec = require('shell-exec')

export async function gitDirHash(dirname: string) {
  const GIT_DIR_HASH_CMD = "git ls-files -s . | git hash-object --stdin"
  const EMPTY_DIR_HASH='e69de29bb2d1d6434b8b29ae775ad8c2e48c5391'
  if(!fs.existsSync(dirname)){
    throw new Error(`Directory ${dirname} does not exist!`)
  }

  const dirHash = await shellExec(GIT_DIR_HASH_CMD, { cwd: dirname, env: { ...process.env, ...{ BRANCH_NAME: "master" } } }).then(
    ({ stdout, stderr,code }) => {
      if (code !== 0) throw new Error(`Process exited with code ${code} while calculating dir hash. \n${stdout}\n ${stderr}\n` )
      let hash = stdout.trim()
      if(hash === EMPTY_DIR_HASH){
        return ""
      }
      return hash
    },
  )
  return dirHash
}


export function preferredName(dirVersion: TDirVersion) {
  return dirVersion.dockerRepositoryName || dirVersion.dirName || dirVersion.packageJsonName || undefined
}


export function preferredVersion(dirVersion: TDirVersion): string | undefined {
  return dirVersion.txtVersion || dirVersion.packageJsonVersion || undefined
}

export interface TDirVersion {
  txtVersion?: string
  packageJsonVersion?: string
  packageJsonName?: string
  dirHash?: string
  dirName: string
  dockerRepositoryName?: string
  dockerRegistryOrganization?: string
  dockerRegistry?: string
  branchName?: string
}

export function extractVersionFromVersionTxt(versionTxtContents: string): string {
  return versionTxtContents && versionTxtContents.trim() || ""
}

export function extractVersionFromPackageJson(packageJsonContents: string): string | undefined {
  if (!packageJsonContents) {
    return undefined
  }
  let packageJs = JSON.parse(packageJsonContents)
  return packageJs.version
}

function extractNameAndVersionFromPackageJson(packageJsonContents: string): {packageJsonName: string, packageJsonVersion:string }  {
  let packageJs = JSON.parse(packageJsonContents)
  return {
    packageJsonVersion: packageJs.version,
    packageJsonName: packageJs.name
  }
}


async function extractFromFile<ReturnType>(fileName: string, extractMethod: (fileContents: Buffer) => ReturnType): Promise<undefined | ReturnType> {
  if (!fs.existsSync(fileName)) {
    return undefined
  }
  return fs.promises.readFile(fileName).then(extractMethod)
}

async function getVersionTxtVersion(dirname: string): Promise<string | undefined> {
  return extractFromFile(path.join(dirname, "version.txt"), (txtFileContents) => {
    return extractVersionFromVersionTxt(txtFileContents.toString("utf8"))
  })

}

async function getPackageJsonInfo(dirname: string) {
  return extractFromFile(path.join(dirname, "package.json"), (jsonContents) => {
    return extractNameAndVersionFromPackageJson(jsonContents.toString("utf8"))
  })

}

async function getShepherdJsonDockerRepoName(dirname: string) {
  return extractFromFile(path.join(dirname, "shepherd.json"), (fileContents: Buffer) => {
    let jsonStruct = JSON.parse(fileContents.toString('utf8'))
    return {dockerRepository:  jsonStruct.dockerRepository, dockerOrganization: jsonStruct.dockerOrganization }
  })
}

export async function versionInfo(dirname: string, options?:{ dockerRegistry:string, branchName: string}) {
  let dirHash = await gitDirHash(dirname)
  let packageJsonInfo = await getPackageJsonInfo(dirname)

  let versionTxt = await getVersionTxtVersion(dirname)
  let shepherdJsonInfo = await getShepherdJsonDockerRepoName(dirname)

  const dirVersion: TDirVersion = {
    dirHash: dirHash,
    dirName: path.basename(dirname),
    packageJsonName: packageJsonInfo?.packageJsonName,
    packageJsonVersion: packageJsonInfo?.packageJsonVersion,
    txtVersion: versionTxt,
    dockerRepositoryName: shepherdJsonInfo?.dockerRepository,
    dockerRegistryOrganization: shepherdJsonInfo?.dockerOrganization,
    dockerRegistry : options?.dockerRegistry,
    branchName : options?.branchName
  }
  return dirVersion
}
