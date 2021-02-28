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
import { TLogContext } from "./logging/logger"

export enum THerdSectionType {
  infrastructure = "infrastructure",
  images = "images",
  folders = "folders",
}

export type THerdSectionDeclaration = {
  herdSectionIndex: number // Herd chapter index
  herdSectionType: THerdSectionType // Type of declaration in herd file (infrastructure, images, folders)
}

export type THerdDeclaration = {
  key: string
  description?: string
  delete?: boolean

  featureDeployment?: boolean
  timeToLiveHours?: number
  branchName?: string

  sectionDeclaration?: THerdSectionDeclaration
}

export type TFolderHerdDeclaration = THerdDeclaration & {
  path: string
}

export type OmitKey<T> = Omit<T, "key">

export type TDockerImageHerdDeclaration = THerdDeclaration & {
  dockerImage?: string

  image: string
  imagetag: string
}

export function isDockerImageHerdSpec(
  spec: TDockerImageHerdDeclaration | TFolderHerdDeclaration
): spec is TDockerImageHerdDeclaration {
  return Boolean((spec as TDockerImageHerdDeclaration).image)
}

export function isDockerDeploymentAction(spec: IAnyDeploymentAction): spec is IDockerDeploymentAction {
  return Boolean((spec as IDockerDeploymentAction).dockerParameters)
}

export function isK8sDeploymentAction(spec: IStatefulExecutableAction): spec is IKubectlDeployAction {
  return Boolean((spec as IKubectlDeployAction).descriptor)
}

export type TK8sDeploymentPlan = {
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
  // TODOLATER This will need git information from directory containing configuration
  path: TFileSystemPath
  buildDate: TISODateString
  displayName: string
  semanticVersion: string
  deploymentType: TDeploymentType
  hyperlinks: Array<THref>
}

export type TActionResult = {
  code?: number
  stdOut?: string
  stdErr?: string

  executedAction?: IExecutableActionV2<TActionResult>
}

export interface IExecutableActionV2<TActionReturnType extends TActionResult> {
  planString(): string

  execute(deploymentOptions: TActionExecutionOptions): Promise<TActionReturnType>
}

/* TODO This whole type system around executable action needs to be rethought.
 *  a) It was a hasty and a bad decision to return itself from execution. Needs to be result type that refers to the original spec.
 *  b) Statefulness needs to be more explicit and flexible, and not a part of the inheritance hierarchy.
 * */
export interface IBasicExecutableAction {
  planString(): string

  execute(deploymentOptions: TActionExecutionOptions): Promise<IStatefulExecutableAction>
}

export interface IStatefulExecutableAction extends IBasicExecutableAction {
  isStateful: boolean
  descriptor: string

  getActionDeploymentState(): TDeploymentState | undefined
  setActionDeploymentState(newState: TDeploymentState | undefined): void

  canRollbackExecution(): this is ICanRollbackActionExecution
}

export type TRollbackResult = TActionResult & {
  code: number
  stdOut?: string
  stdErr?: string
}

export interface ICanRollbackActionExecution {
  rollback(deploymentOptions: TActionExecutionOptions): Promise<TRollbackResult>
}

export function canRollbackExecution(action: object): action is ICanRollbackActionExecution {
  return Boolean((action as ICanRollbackActionExecution).rollback)
}

export interface IBaseDeploymentAction {
  metadata: TImageMetadata | TFolderMetadata
  herdKey: string
  identifier: string
  env: string
  type: string
  version?: string
}

export interface IDockerExecutableAction extends IStatefulExecutableAction {
  command: string
  descriptor: string
  dockerParameters: string[]
  operation: string
  origin: string
  imageWithoutTag?: string
  forTestParameters?: string[]
  identifier: string

  execute(deploymentOptions: TActionExecutionOptions): Promise<IDockerExecutableAction>
}

export interface IDockerDeploymentAction extends IDockerExecutableAction, IBaseDeploymentAction {
  displayName: string
  herdDeclaration: TDockerImageHerdDeclaration
  metadata: TDeployerMetadata
}

export interface IKubectlAction extends IStatefulExecutableAction {
  identifier: string
  type: string
  operation: string
}

export interface IKubectlDeployAction extends IKubectlAction {
  deploymentRollouts: TDeploymentRollout[]
  descriptor: string
  descriptorsByKind?: TDescriptorsByKind
  fileName: string
  origin: string
}

export function isKubectlDeployAction(deployAction: IStatefulExecutableAction): deployAction is IKubectlDeployAction {
  return Boolean((deployAction as IKubectlDeployAction).deploymentRollouts)
}

export interface IK8sDirDeploymentAction extends IKubectlDeployAction, IBaseDeploymentAction {
  herdDeclaration: TFolderHerdDeclaration
  metadata: TFolderMetadata
}

export interface IDockerImageKubectlDeploymentAction extends IKubectlDeployAction, IBaseDeploymentAction {
  herdDeclaration: TDockerImageHerdDeclaration
  metadata: TK8sMetadata
}

export type IAnyDeploymentAction =
  | IDockerDeploymentAction
  | IDockerImageKubectlDeploymentAction
  | IK8sDirDeploymentAction

export type TDeploymentOptions = {
  dryRunOutputDir: TFileSystemPath | undefined
  dryRun: boolean
}

export type TActionExecutionOptions = TDeploymentOptions & {
  waitForRollout: boolean
  rolloutWaitSeconds?: number
  pushToUi: boolean
  logContext: TLogContext
}

export type TDeploymentOrchestrationDependencies = {}

export type FnDeploymentStateSave = (stateSignatureObject: any) => Promise<TDeploymentState>

export type IPushToShepherdUI = { pushDeploymentStateToUI: (deploymentState: any) => Promise<any | undefined> }
