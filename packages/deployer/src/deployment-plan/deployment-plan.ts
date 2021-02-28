import {
  IAnyDeploymentAction,
  IBasicExecutableAction,
  ICanRollbackActionExecution,
  IStatefulExecutableAction,
  IKubectlDeployAction,
  IPushToShepherdUI,
  isDockerDeploymentAction,
  isKubectlDeployAction,
  TActionExecutionOptions,
  THerdDeclaration,
  TImageInformation,
  TRollbackResult,
} from "../deployment-types"
import { IReleaseStateStore, TDeploymentStateParams } from "@shepherdorg/state-store"
import { emptyArray } from "../helpers/ts-functions"
import { ICreateRolloutWaitAction } from "../deployment-actions/kubectl-action/rollout-wait-action-factory"
import { mapUntypedDeploymentData } from "../ui-mapping/map-untyped-deployment-data"
import { TFileSystemPath } from "../helpers/basic-types"
import * as path from "path"
import { writeFile } from "../helpers/promisified-exec"
import {
  ICreateDeploymentTestAction,
  IRollbackAction,
} from "../deployment-actions/deployment-test-action/deployment-test-action"
import { ICreateDockerDeploymentActions } from "../deployment-actions/docker-action/create-docker-deployment-action"
import { ICreateDockerImageKubectlDeploymentActions } from "../deployment-actions/kubectl-action/create-docker-kubectl-deployment-actions"
import { newProgrammerOops } from "oops-error"
import { renderPlanExecutionError } from "./renderPlanExecutionError"
import { ILog, LOG_CONTEXT_PREFIX_PADDING, TLogContext } from "../logging/logger"
import * as chalk from "chalk"
import { padLeft } from "../logging/padleft"
import { IProvideLogContextColors } from "../logging/log-context-colors"
import { ICreateDeploymentTimeAnnotationActions } from "../deployment-actions/kubectl-action/k8s-branch-deployment/create-deployment-time-annotation-action"

export interface IDeploymentPlanExecutionResult {
  actionResults: IStatefulExecutableAction[]
  actionExecutionError?: Error
  herdDeclaration: THerdDeclaration
}

export function renderPlanFailureSummary(logger: ILog, failedPlans: IDeploymentPlanExecutionResult[]) {
  logger.error(
    `Execution of ${failedPlans.length} deployment plan(s) resulted in failure, test or otherwise. Full error logs found above.`
  )
  logger.error(`vvvvvvvvvvvvvvvv failed deployments vvvvvvvvvvvvvvvvvvvv`)
  failedPlans.forEach(failedPlan => {
    logger.error(`    ${failedPlan.herdDeclaration.key}  ${failedPlan.herdDeclaration.description || ""}`)
  })
  logger.error(`^^^^^^^^^^^^^^^^ failed deployments ^^^^^^^^^^^^^^^^^^^^`)
}

export interface IDeploymentPlan {
  herdKey: string
  herdDeclaration: THerdDeclaration
  deploymentActions: Array<IStatefulExecutableAction>

  addAction(action: IBasicExecutableAction): Promise<void>
  execute(deploymentOptions: TActionExecutionOptions): Promise<IDeploymentPlanExecutionResult>
  hasModifiedAction(): boolean
  hasStatefulAction(): boolean

  /**
   * Returns false if there is nothing planned, true otherwise
   * */
  printPlan(logger: ILog): boolean
  exportActions(_exportDirectory: TFileSystemPath): Promise<void>
}

export type TK8sDeploymentPlansByKey = { [herdKey: string]: string }

export const NO_ROLLBACK_RESULT = { code: 0 }

export interface TDeploymentPlanDependencies {
  deploymentEnvironment: string
  ttlAnnotationActionFactory: ICreateDeploymentTimeAnnotationActions
  logContextColors: IProvideLogContextColors
  stateStore: IReleaseStateStore
  exec: any
  logger: ILog
  uiDataPusher: IPushToShepherdUI
  rolloutWaitActionFactory: ICreateRolloutWaitAction
  dockerImageKubectlDeploymentActionFactory: ICreateDockerImageKubectlDeploymentActions
  deployerActionFactory: ICreateDockerDeploymentActions
  deploymentTestActionFactory: ICreateDeploymentTestAction
}

export interface IDeploymentPlanFactory {
  createDeploymentPlan: (herdSpec: THerdDeclaration) => IDeploymentPlan

  createDockerImageDeploymentActions(
    imageInformation: TImageInformation,
    envFilter: string
  ): Promise<Array<IStatefulExecutableAction>>

  createDockerImageDeploymentPlan(imageInformation: TImageInformation): Promise<IDeploymentPlan>
}

export function createDeploymentPlanFactory(injected: TDeploymentPlanDependencies): IDeploymentPlanFactory {
  async function createRolloutWaitActions(
    kubectlDeployAction: IKubectlDeployAction
  ): Promise<Array<IStatefulExecutableAction>> {
    const resultingActions: Array<IStatefulExecutableAction> = []
    if (
      kubectlDeployAction.deploymentRollouts &&
      kubectlDeployAction.operation === "apply" &&
      kubectlDeployAction.getActionDeploymentState()?.modified
    ) {
      await Promise.all(
        kubectlDeployAction.deploymentRollouts.map(async deploymentRollout => {
          resultingActions.push(await injected.rolloutWaitActionFactory.createRolloutWaitAction(deploymentRollout))
        }, {})
      )
    }

    return resultingActions
  }

  function createDeploymentPlan(herdDeclaration: THerdDeclaration): IDeploymentPlan {
    const deploymentActions: Array<IStatefulExecutableAction> = []

    let planLogContext: TLogContext = {
      prefix: padLeft(LOG_CONTEXT_PREFIX_PADDING, herdDeclaration.key, true),
      color: injected.logContextColors.nextLogContextColor(),
      performanceLog: true,
    }

    async function mapDeploymentDataAndPush(deploymentData: IStatefulExecutableAction | undefined) {
      if (!deploymentData) {
        return deploymentData
      } else {
        const mappedData = mapUntypedDeploymentData(deploymentData as IAnyDeploymentAction)
        if (injected.uiDataPusher && deploymentData.isStateful) {
          await injected.uiDataPusher.pushDeploymentStateToUI(mappedData)
        }
        return deploymentData
      }
    }

    let planInstance: IDeploymentPlan = {
      hasModifiedAction(): boolean {
        return deploymentActions.reduce((planModified: boolean, action) => {
          return planModified || (action.isStateful && action.getActionDeploymentState()?.modified) || false
        }, false)
      },

      hasStatefulAction(): boolean {
        return deploymentActions.reduce((planModified: boolean, action) => {
          return planModified || action.isStateful
        }, false)
      },

      async execute(executionOptions: TActionExecutionOptions): Promise<IDeploymentPlanExecutionResult> {
        // console.log(`RUNNING ${deploymentActions.length} actions... \n ${deploymentActions.map((action)=>{return action.planString() + '\n'})}`)
        if (!planInstance.hasStatefulAction()) {
          throw new Error(
            `Plan for ${chalk.red(herdDeclaration.key)} has no stateful action! This is probably a programming error.`
          )
        }
        let actionResults: IStatefulExecutableAction[] = []
        if (!planInstance.hasModifiedAction()) {
          return { herdDeclaration: herdDeclaration, actionResults }
        }

        try {
          let executionPromise = deploymentActions.reduce((p, nextAction) => {
            return p.then(actionResults => {
              return nextAction
                .execute({ ...executionOptions, ...{ logContext: planLogContext } })
                .then(async actionResult => {
                  actionResults.push(actionResult)
                  if (!executionOptions.dryRun && executionOptions.pushToUi) {
                    await mapDeploymentDataAndPush(nextAction)
                  }
                  return actionResults
                })
            })
          }, Promise.resolve(emptyArray<IStatefulExecutableAction>()))
          actionResults = await executionPromise
          return { herdDeclaration: herdDeclaration, actionResults }
        } catch (actionExecutionError) {
          renderPlanExecutionError(injected.logger, actionExecutionError, planLogContext)
          return { herdDeclaration, actionExecutionError, actionResults }
        }
      },
      async addAction(action: IStatefulExecutableAction): Promise<void> {
        injected.logger.debug(`Adding action to plan ${herdDeclaration.key} ${action.planString()}`)
        deploymentActions.push(action)

        if (action.isStateful && !action.getActionDeploymentState()) {
          let deploymentState = await injected.stateStore.getDeploymentState(
            (action as unknown) as TDeploymentStateParams
          )
          action.setActionDeploymentState(deploymentState)
        }
      },
      async exportActions(exportDirectory: TFileSystemPath) {
        await Promise.all(
          deploymentActions.map(function(action: IAnyDeploymentAction) {
            if (isDockerDeploymentAction(action)) {
              if (!action.forTestParameters) {
                throw new Error("Missing forTestParameters!")
              }
              if (!action.imageWithoutTag) {
                throw new Error("Missing forTestParameters!")
              }
              let cmdLine = `docker run ${action.forTestParameters.join(" ")}`

              let writePath = path.join(exportDirectory, action.imageWithoutTag.replace(/\//g, "_") + "-deployer.txt")
              return writeFile(writePath, cmdLine)
            } else if (isKubectlDeployAction(action)) {
              let writePath = path.join(
                exportDirectory,
                action.operation + "-" + action.identifier.toLowerCase() + ".yaml"
              )
              return writeFile(writePath, action.descriptor.trim())
            } // else its a followup action, such as rollout status or e2e test, which we do not export
          })
        ).then(() => {
          injected.logger.debug(
            `Exported ${deploymentActions.length} actions to ${exportDirectory} from ${herdDeclaration.key}`
          )
        })
      },
      printPlan(logger: ILog): boolean {
        if (!planInstance.hasModifiedAction()) {
          return false
        }
        let modified = false

        deploymentActions.forEach(function(deploymentAction: IStatefulExecutableAction) {
          let printPlanLogContext: TLogContext = { ...planLogContext, ...{ performanceLog: false } }
          let deploymentState = deploymentAction.getActionDeploymentState()
          if (deploymentAction.isStateful && deploymentState) {
            if (deploymentState.modified) {
              if (!modified) {
                if (herdDeclaration) {
                  logger.info(`Deploying ${herdDeclaration.key}`, printPlanLogContext)
                } else {
                  logger.info("Missing herdKey for " + planInstance, printPlanLogContext)
                }
              }
              modified = true
              logger.info(`  - ${deploymentAction.planString()}`, printPlanLogContext)
            } else if (modified) {
              logger.info(`  - ${deploymentAction.planString()}`, printPlanLogContext)
            } // else stateful and not modified
          } else if (modified) {
            // Supporting action such as rollout wait or deployment test
            logger.info(`  -  > ${deploymentAction.planString()}`, printPlanLogContext)
          } // Not stateful and nothing else modified either
        })
        return modified
      },
      herdKey: herdDeclaration.key,
      herdDeclaration,
      deploymentActions: deploymentActions,
    }
    return planInstance
  }

  async function createDockerImageDeploymentActions(imageInformation: TImageInformation, envFilter: string) {
    let planLogContext: TLogContext = {
      prefix: padLeft(LOG_CONTEXT_PREFIX_PADDING, imageInformation.imageDeclaration.key, true),
      color: injected.logContextColors.nextLogContextColor(),
      performanceLog: true,
    }

    if (imageInformation.shepherdMetadata) {
      let resultingActions: Array<IStatefulExecutableAction> = emptyArray<IStatefulExecutableAction>()

      if (!imageInformation.imageDeclaration) {
        throw newProgrammerOops("Invalid image information, no image declaration!", imageInformation)
      }
      if (imageInformation.shepherdMetadata.preDeploymentTests) {
        imageInformation.shepherdMetadata.preDeploymentTests.forEach(deploymentTestSpec => {
          if (imageInformation.shepherdMetadata && deploymentTestSpec.inEnvironments.includes(envFilter)) {
            // To satisfy typescript, not sure why the outside check is not enough
            resultingActions.push(
              injected.deploymentTestActionFactory.createDeploymentTestAction(
                deploymentTestSpec,
                imageInformation.shepherdMetadata
              )
            )
          } else {
          }
        })
      }
      let deploymentActions: Array<IStatefulExecutableAction>
      if (imageInformation.shepherdMetadata.deploymentType === "deployer") {
        deploymentActions = await injected.deployerActionFactory.createDockerDeploymentAction(
          imageInformation,
          planLogContext
        )
      } else if (imageInformation.shepherdMetadata.deploymentType === "k8s") {
        deploymentActions = await injected.dockerImageKubectlDeploymentActionFactory.createKubectlDeploymentActions(
          imageInformation
        )

        await Promise.all(
          deploymentActions.map(async (depAction: IStatefulExecutableAction) => {
            if (depAction.isStateful) {
              depAction.setActionDeploymentState(
                await injected.stateStore.getDeploymentState((depAction as unknown) as TDeploymentStateParams)
              )
            }

            if (imageInformation.imageDeclaration.timeToLiveHours) {
              if (isKubectlDeployAction(depAction)) {
                let ttAnnotationActionFactory = injected.ttlAnnotationActionFactory
                let ttlAnnotationActions = ttAnnotationActionFactory.createDeploymentTimeAnnotationActions(
                  depAction.descriptorsByKind
                )
                ttlAnnotationActions.map(annotationAction => {
                  deploymentActions.push(annotationAction)
                })
              }
            }
            if (isKubectlDeployAction(depAction)) {
              let waitActions = await createRolloutWaitActions(depAction)
              waitActions.map(waitAction => {
                deploymentActions.push(waitAction)
              })
            }
          })
        )
      } else {
        throw new Error(
          `Unexpected: No planner in place for deploymentType ${imageInformation.shepherdMetadata.deploymentType} in ${imageInformation.shepherdMetadata.displayName} `
        )
      }
      resultingActions = resultingActions.concat(deploymentActions)

      if (imageInformation.shepherdMetadata.postDeploymentTests) {
        let deploymentActionsRollback: IRollbackAction = {
          async rollback(executionOptions: TActionExecutionOptions): Promise<TRollbackResult> {
            return await Promise.all(
              deploymentActions.map(
                rollback =>
                  (rollback.canRollbackExecution() && rollback.rollback(executionOptions)) || NO_ROLLBACK_RESULT
              )
            ).then(() => {
              return { code: 0 }
            })
          },
        }

        imageInformation.shepherdMetadata.postDeploymentTests.forEach(deploymentTestSpec => {
          if (imageInformation.shepherdMetadata && deploymentTestSpec.inEnvironments.includes(envFilter)) {
            // To satisfy typescript, not sure why the outside check is not enough
            resultingActions.push(
              injected.deploymentTestActionFactory.createDeploymentTestAction(
                deploymentTestSpec,
                imageInformation.shepherdMetadata,
                deploymentActionsRollback
              )
            )
          } else {
          }
        })
      }

      return resultingActions
    } else {
      throw new Error("No shepherd metadata present! Do not know what to do with " + JSON.stringify(imageInformation))
    }
  }

  async function createDockerImageDeploymentPlan(imageInformation: TImageInformation) {
    if (imageInformation.shepherdMetadata) {
      const resultingActions = await createDockerImageDeploymentActions(
        imageInformation,
        injected.deploymentEnvironment
      )
      const resultingPlan = createDeploymentPlan(imageInformation.imageDeclaration)
      await Promise.all(resultingActions.map(resultingPlan.addAction))

      return resultingPlan
    } else {
      throw new Error("No shepherd metadata present! Do not know what to do with " + JSON.stringify(imageInformation))
    }
  }

  return {
    createDeploymentPlan,
    createDockerImageDeploymentActions: createDockerImageDeploymentActions,
    createDockerImageDeploymentPlan: createDockerImageDeploymentPlan,
  }
}
