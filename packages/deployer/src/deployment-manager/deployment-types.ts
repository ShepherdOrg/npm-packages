import {
  TDeployerMetadata,
  TDeploymentState,
  TDeploymentType,
  THref,
  TImageMetadata,
  TK8sMetadata,
  TTarFolderStructure,
} from "@shepherdorg/metadata"
import { TDescriptorsByKind } from "./kubectl-deployer/k8s-deployment-document-identifier"
import { TFileSystemPath, TISODateString } from "../basic-types"
import { TDockerImageLabels } from "@shepherdorg/docker-image-metadata-loader"

export type ILog = {
  info: typeof console.info,
  debug: typeof console.debug,
  warn: typeof console.warn
}

export type THerdSpec = {
  key: string;
  description?: string;
  delete?: boolean;

  featureDeployment?: boolean
  timeToLiveHours?: number
  branchName?: string
}


export type TFolderHerdSpec = THerdSpec & {
  path: string;
}

export type OmitKey<T> = Omit<T, 'key'>

export type TDockerImageHerdSpec = THerdSpec & {
  dockerImage?: string;

  image: string;
  imagetag: string;
}

export function isDockerImageHerdSpec(spec: TDockerImageHerdSpec | TFolderHerdSpec): spec is TDockerImageHerdSpec {
  return Boolean((spec as TDockerImageHerdSpec).image)
}

export type TK8sDeploymentPlan2 = {
  dockerLabels?: TDockerImageLabels
  deployments?: {}
  herdKey: string
  displayName: string
  files?: TTarFolderStructure
}


export type TShepherdMetadata = {
  imageDefinition: TDockerImageHerdSpec
  shepherdMetadata?: TImageMetadata
}

export type TImageInformation = TShepherdMetadata & {
  env: string
  dockerLabels: {[key: string]: any}
}


/// From metadata module, discrepancy here...key and herdKey

/// New types below

export type TDockerImageHerdSpecs = { [imageKey: string]: OmitKey<TDockerImageHerdSpec> }
export type TFolderHerdSpecs = { [imageKey: string]: OmitKey<TFolderHerdSpec> }

export type THerdFileStructure = {
  folders?: TFolderHerdSpecs
  infrastructure?: TDockerImageHerdSpecs
  images?: TDockerImageHerdSpecs
}
export type TFolderMetadata = {
  //TODO This will need git information from directory containing configuration
  path: TFileSystemPath
  buildDate: TISODateString
  displayName: string
  semanticVersion: string,
  deploymentType: TDeploymentType,
  hyperlinks: Array<THref>,
}

// export interface TFolderDeploymentPlan {
//   operation: string;
//   identifier: string;
//   version: string;
//   descriptor: string;
//   origin: string;
//   type: string;
//   fileName: string;
//   herdKey: string;
//   herdSpec: TFolderHerdSpec;
//   metadata: TFolderMetadata;
// }

export interface TBaseDeploymentAction {
  metadata: TImageMetadata | TFolderMetadata;
  herdKey: string;
  state?: TDeploymentState // State on action or deployment? StateDependentAction, StateMutatingAction (as opposed to wait actions). Model this differently?
  identifier: string
  env: string
  type: string
  version?: string
}

export interface TDockerDeploymentAction extends TBaseDeploymentAction{
  herdSpec: TDockerImageHerdSpec;
  metadata: TDeployerMetadata;

  command: string;
  descriptor: string;
  displayName: string;
  dockerParameters: string[];
  forTestParameters?: string[];
  identifier: string;
  imageWithoutTag?: string;
  operation: string;
  origin: string;
}


export interface TKubectlDeployAction {
  descriptorsByKind?: TDescriptorsByKind
  identifier: string
  descriptor: string
  deploymentRollouts: string[] // TODO Move into deploymentActions
  origin: string
  operation: string

  state?: TDeploymentState

  execute(deploymentOptions:TActionExecutionOptions, cmd:string, logger:ILog, saveDeploymentState:FnDeploymentStateSave):void
}

export interface TK8sDirDeploymentAction extends TKubectlDeployAction, TBaseDeploymentAction{
  herdSpec: TFolderHerdSpec
  metadata: TFolderMetadata
}

export interface TK8sDockerImageDeploymentAction extends TKubectlDeployAction, TBaseDeploymentAction {
  herdSpec: TDockerImageHerdSpec
  metadata: TK8sMetadata
  fileName: string,
}


export type TAnyDeploymentAction = TDockerDeploymentAction | TK8sDockerImageDeploymentAction | TK8sDirDeploymentAction


export type TDeploymentPlan = {
  herdKey: string,
  deployments: Array<TAnyDeploymentAction> // TODO Rename to deployment actions
}

export type TK8sDeploymentPlan = [string, any]

export type TDockerDeploymentPlanTuple = [string, any]

export type TDockerDeploymentPlan = { [key: string]: any }

export type TDeploymentOptions = {
  dryRunOutputDir: TFileSystemPath | undefined
  dryRun: boolean
}

export type TActionExecutionOptions = TDeploymentOptions & {
  waitForRollout: boolean
  pushToUi: boolean
}

export type TReleasePlanDependencies = {   // TODO: Really need good types on this
  stateStore: any
  cmd: any
  logger: ILog
  uiDataPusher: any
}

export type FnDeploymentStateSave = (stateSignatureObject:any)=> Promise<TDeploymentState>

export type TK8sDeploymentActionMap = { [key: string]: any }

export interface TReleasePlan {
  executePlan: (runOptions?: TActionExecutionOptions) => Promise<Array<(TAnyDeploymentAction | undefined)>>
  printPlan: (logger: ILog) => void
  exportDeploymentDocuments: (exportDirectory: TFileSystemPath) => Promise<unknown>
  addDeployment: (deploymentAction: (TAnyDeploymentAction)) => Promise<TAnyDeploymentAction>
}

export type FReleasePlanner = (env: string) => TReleasePlan
