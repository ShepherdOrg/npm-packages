import {
  TDeployerMetadata,
  TDeploymentState,
  TDeploymentType,
  THref,
  TImageMetadata,
  TK8sMetadata,
  TTarFolderStructure,
} from "@shepherdorg/metadata"
import { TDescriptorsByKind } from "./deployment-actions/kubectl-action/k8s-deployment-document-identifier"
import { TFileSystemPath, TISODateString } from "./helpers/basic-types"
import { TDockerImageLabels } from "@shepherdorg/docker-image-metadata-loader"
import { TDeploymentRollout } from "./deployment-actions/kubectl-action/kubectl-deployment-action-factory"
import { IDeploymentPlan, IDeploymentPlanExecutionResult } from "./deployment-plan/deployment-plan-factory"

export type ILog = {
  info: typeof console.info,
  debug: typeof console.debug,
  warn: typeof console.warn
  error: typeof console.error
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

export function isDockerDeploymentAction(spec: IAnyDeploymentAction): spec is IDockerDeploymentAction {
  return Boolean((spec as IDockerDeploymentAction).dockerParameters)
}

export function isK8sDeploymentAction(spec: IExecutableAction): spec is IKubectlDeployAction {
  return Boolean((spec as IKubectlDeployAction).descriptor)
}

export type TK8sDeploymentPlan2 = {
  dockerLabels?: TDockerImageLabels
  deployments?: {}
  herdKey: string
  displayName: string
  files?: TTarFolderStructure
}


export type TShepherdMetadata = {
  imageDeclaration: TDockerImageHerdDeclaration
  shepherdMetadata?: TImageMetadata
}

export type TImageInformation = TShepherdMetadata & {
  env: string
  dockerLabels: { [key: string]: any }
}


/// From metadata module, discrepancy here...key and herdKey

/// New types below

export type TDockerImageHerdDeclarations = { [imageKey: string]: OmitKey<TDockerImageHerdDeclaration> }
export type TFolderHerdDeclarations = { [imageKey: string]: OmitKey<TFolderHerdDeclaration> }

export type THerdFileStructure = {
  folders?: TFolderHerdDeclarations
  infrastructure?: TDockerImageHerdDeclarations
  images?: TDockerImageHerdDeclarations
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
  isStateful: boolean
  state?: TDeploymentState
  descriptor: string

  planString():string

  execute(
    deploymentOptions: TActionExecutionOptions
  ): Promise<IExecutableAction>

  canRollbackExecution(): this is IRollbackActionExecution
}

export type TRollbackResult ={
  code?: number
  stdOut?: string
  stdErr?: string
}

export interface IRollbackActionExecution{
  rollback(): Promise<TRollbackResult>
}

export function canRollbackExecution(action: object): action is IRollbackActionExecution{
  return Boolean((action as IRollbackActionExecution).rollback)
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

export interface IDockerExecutableAction extends IExecutableAction{
  command: string;
  descriptor: string;
  dockerParameters: string[];
  operation: string;
  origin: string;
  imageWithoutTag?: string;
  forTestParameters?: string[];
  identifier: string;
  execute(deploymentOptions: TActionExecutionOptions): Promise<IDockerExecutableAction>
}

export interface IDockerDeploymentAction extends IDockerExecutableAction, IBaseDeploymentAction {
  displayName: string;
  herdDeclaration: TDockerImageHerdDeclaration;
  metadata: TDeployerMetadata;
}

export interface IKubectlAction extends  IExecutableAction{
  identifier: string
  type: string
  operation: string
}

export interface IKubectlDeployAction extends IKubectlAction {
  deploymentRollouts: TDeploymentRollout[] // TODO Move into deploymentActions
  descriptor: string
  descriptorsByKind?: TDescriptorsByKind
  fileName: string,
  origin: string

  state?: TDeploymentState
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

export type TDeploymentOrchestrationDependencies = {
}

export type FnDeploymentStateSave = (stateSignatureObject: any) => Promise<TDeploymentState>


export interface IDeploymentOrchestration {
  executePlans: (runOptions?: TActionExecutionOptions) => Promise<Array<IDeploymentPlanExecutionResult>>

  /** Returns true if there is anything planned to be executed. */
  printPlan: (logger: ILog) => boolean
  exportDeploymentActions: (exportDirectory: TFileSystemPath) => Promise<unknown>
  addDeploymentPlan(deploymentPlan: IDeploymentPlan): Promise<IDeploymentPlan>
}

export type FDeploymentOrchestrationConstructor = (env: string) => IDeploymentOrchestration
