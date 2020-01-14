import {
  TDeployerMetadata,
  TDeploymentState,
  TDeploymentType,
  THref,
  TImageMetadata,
  TK8sMetadata,
  TTarFolderStructure,
} from "@shepherdorg/metadata"
import { TDescriptorsByKind } from "./deployment-actions/kubectl-deployer/k8s-deployment-document-identifier"
import { TFileSystemPath, TISODateString } from "./helpers/basic-types"
import { TDockerImageLabels } from "@shepherdorg/docker-image-metadata-loader"
import { ReleaseStateStore } from "@shepherdorg/state-store"

export type ILog = {
  info: typeof console.info,
  debug: typeof console.debug,
  warn: typeof console.warn
}

export enum THerdSectionType {
  infrastructure = "infrastructure",
  images = "images",
  folders = "folders"
}

export type THerdSectionDeclaration = {
  herdSectionIndex: number // Herd chapter index
  herdSectionType: THerdSectionType // Type of declaration in herd file (infrastructure, images, folders)
}

export type THerdDeclaration = {
  key: string;
  description?: string;
  delete?: boolean;

  featureDeployment?: boolean
  timeToLiveHours?: number
  branchName?: string

  sectionDeclaration?: THerdSectionDeclaration
}


export type TFolderHerdDeclaration = THerdDeclaration & {
  path: string;
}

export type OmitKey<T> = Omit<T, "key">

export type TDockerImageHerdDeclaration = THerdDeclaration & {
  dockerImage?: string;

  image: string;
  imagetag: string;
}

export function isDockerImageHerdSpec(spec: TDockerImageHerdDeclaration | TFolderHerdDeclaration): spec is TDockerImageHerdDeclaration {
  return Boolean((spec as TDockerImageHerdDeclaration).image)
}

export type TK8sDeploymentPlan2 = {
  dockerLabels?: TDockerImageLabels
  deployments?: {}
  herdKey: string
  displayName: string
  files?: TTarFolderStructure
}


export type TShepherdMetadata = {
  imageDefinition: TDockerImageHerdDeclaration
  shepherdMetadata?: TImageMetadata
}

export type TImageInformation = TShepherdMetadata & {
  env: string
  dockerLabels: { [key: string]: any }
}


/// From metadata module, discrepancy here...key and herdKey

/// New types below

export type TDockerImageHerdSpecs = { [imageKey: string]: OmitKey<TDockerImageHerdDeclaration> }
export type TFolderHerdSpecs = { [imageKey: string]: OmitKey<TFolderHerdDeclaration> }

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

export interface IExecutableAction {
  pushToUI: boolean
  state?: TDeploymentState
  descriptor: string

  planString?():string

  execute(
    deploymentOptions: TActionExecutionOptions,
    cmd: any,
    logger: ILog,
    saveDeploymentState: FnDeploymentStateSave
  ): Promise<IExecutableAction>
}

export interface IBaseDeploymentAction {
  metadata: TImageMetadata | TFolderMetadata;
  herdKey: string;
  state?: TDeploymentState // State on action or deployment? StateDependentAction, StateMutatingAction (as opposed to wait actions). Model this differently?
  identifier: string
  env: string
  type: string
  version?: string
}

export interface IDockerDeploymentAction extends IBaseDeploymentAction, IExecutableAction {
  herdDeclaration: TDockerImageHerdDeclaration;
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

  execute(deploymentOptions: TActionExecutionOptions, cmd: any, logger: ILog, saveDeploymentState: FnDeploymentStateSave): Promise<IDockerDeploymentAction>
}


export interface IKubectlDeployAction extends IExecutableAction {
  deploymentRollouts: string[] // TODO Move into deploymentActions
  descriptor: string
  descriptorsByKind?: TDescriptorsByKind
  fileName: string,
  identifier: string
  operation: string
  origin: string

  state?: TDeploymentState

  execute(deploymentOptions: TActionExecutionOptions, cmd: any, logger: ILog, saveDeploymentState: FnDeploymentStateSave): Promise<IKubectlDeployAction>
}

export function isKubectlDeployAction(deployAction: IExecutableAction): deployAction is IKubectlDeployAction {
  return Boolean((deployAction as IKubectlDeployAction).deploymentRollouts)
}


export interface IK8sDirDeploymentAction extends IKubectlDeployAction, IBaseDeploymentAction {
  herdDeclaration: TFolderHerdDeclaration
  metadata: TFolderMetadata
}


export interface IK8sDockerImageDeploymentAction extends IKubectlDeployAction, IBaseDeploymentAction {
  herdDeclaration: TDockerImageHerdDeclaration
  metadata: TK8sMetadata
}


export type IAnyDeploymentAction = IDockerDeploymentAction | IK8sDockerImageDeploymentAction | IK8sDirDeploymentAction


export type TDeploymentOptions = {
  dryRunOutputDir: TFileSystemPath | undefined
  dryRun: boolean
}

export type TActionExecutionOptions = TDeploymentOptions & {
  waitForRollout: boolean
  pushToUi: boolean
}

export type TReleasePlanDependencies = {   // TODO: Need to create types for this
  stateStore: ReturnType<typeof ReleaseStateStore>
  cmd: any
  logger: ILog
  uiDataPusher: any
}

export type FnDeploymentStateSave = (stateSignatureObject: any) => Promise<TDeploymentState>

export type TK8sDeploymentActionMap = { [key: string]: any }

export interface TDeploymentOrchestration {
  executePlan: (runOptions?: TActionExecutionOptions) => Promise<Array<(IAnyDeploymentAction | undefined)>>
  printPlan: (logger: ILog) => void
  exportDeploymentActions: (exportDirectory: TFileSystemPath) => Promise<unknown>
  addDeployment: (deploymentAction: (IAnyDeploymentAction)) => Promise<IAnyDeploymentAction>
}

export type FDeploymentOrchestrationConstructor = (env: string) => TDeploymentOrchestration
