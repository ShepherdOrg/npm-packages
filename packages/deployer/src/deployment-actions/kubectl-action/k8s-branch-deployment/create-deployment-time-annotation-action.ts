import { TK8sPartialDescriptor } from "../k8s-document-types"
import { ILog, TLogContext } from "@shepherdorg/logger"
import { IStatefulExecutableAction, IKubectlAction, TDeploymentOptions } from "../../../deployment-types"
import { TDeploymentState } from "@shepherdorg/metadata"
import { TDescriptorsByKind } from "../k8s-deployment-document-identifier"
import { FProvideTime, FTimer } from "../../../helpers/basic-types"
import { FExec, TExecError } from "@shepherdorg/ts-exec"

export interface TDeploymentTimeAnnotationActionDependencies {
  exec: FExec
  logger: ILog
  systemTime: FProvideTime
  timeout: FTimer
}

export interface ICreateDeploymentTimeAnnotationActions {
  createDeploymentTimeAnnotationAction(deploymentDoc: TK8sPartialDescriptor): IKubectlAction
  createDeploymentTimeAnnotationActions(descriptorsByKind?: TDescriptorsByKind): Array<IStatefulExecutableAction>
}

export function createDeploymentTimeAnnotationActionFactory(
  injected: TDeploymentTimeAnnotationActionDependencies
): ICreateDeploymentTimeAnnotationActions {
  function createDeploymentTimeAnnotationAction(deploymentDoc: TK8sPartialDescriptor): IKubectlAction {
    let identifier = `${deploymentDoc.kind} ${deploymentDoc.metadata.name}`

    let kubeArgs: string[] = [
      "--namespace",
      deploymentDoc.metadata.namespace || "default",
      "annotate",
      "--overwrite",
      deploymentDoc.kind,
      deploymentDoc.metadata.name || "no name!",
      `lastDeploymentTimestamp=${injected.systemTime().toISOString()}`,
    ]

    function planString() {
      return `kubectl ${kubeArgs.join(" ")}`
    }

    let actionRetryCount = 0
    let annotationAction: IKubectlAction = {
      descriptor: planString(),
      identifier: "deployment timestamp " + identifier,
      isStateful: false,
      operation: "annotate",
      type: "k8s",
      canRollbackExecution(): boolean {
        return false
      },
      execute(
        deploymentOptions: TDeploymentOptions & { waitForRollout: boolean; pushToUi: boolean; logContext: TLogContext }
      ): Promise<IStatefulExecutableAction> {
        injected.logger.debug(`Executing ${planString()}`)
        return injected
          .exec(
            "kubectl",
            kubeArgs,
            {
              env: process.env,
            },
            injected.logger
          )
          .then(execResult => {
            injected.logger.info(planString(), deploymentOptions.logContext)
            if (execResult) {
              injected.logger.info(execResult.stdout as string, deploymentOptions.logContext)
            }
            return annotationAction
          })
          .catch(async execError => {
            if (actionRetryCount < 4) {
              actionRetryCount++
              await injected.timeout(() => {}, 500)
              return annotationAction.execute(deploymentOptions)
            } else {
              const { code: code, stdout, message: err } = execError as TExecError
              injected.logger.warn(`Error executing ${planString()}, code ${code}`, deploymentOptions.logContext)
              injected.logger.warn(err, deploymentOptions.logContext)
              if (stdout) {
                injected.logger.warn(stdout, deploymentOptions.logContext)
              }
              return annotationAction
            }
          })
      },
      getActionDeploymentState(): TDeploymentState | undefined {
        return undefined
      },
      planString: planString,
      setActionDeploymentState(newState: TDeploymentState | undefined): void {},
    }
    return annotationAction
  }

  function createDeploymentTimeAnnotationActions(descriptorsByKind: TDescriptorsByKind) {
    const resultingActions: Array<IStatefulExecutableAction> = []
    if (descriptorsByKind) {
      Object.values(descriptorsByKind).forEach(deploymentDocs => {
        deploymentDocs.forEach(deploymentDoc => {
          let annotationAction = createDeploymentTimeAnnotationAction(deploymentDoc)

          resultingActions.push(annotationAction)
        })
      })
    }

    return resultingActions
  }

  let exposed: ICreateDeploymentTimeAnnotationActions = {
    createDeploymentTimeAnnotationActions: createDeploymentTimeAnnotationActions,
    createDeploymentTimeAnnotationAction: createDeploymentTimeAnnotationAction,
  }
  return exposed
}
