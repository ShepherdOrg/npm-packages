import { TK8sPartialDescriptor } from "../k8s-document-types"
import { ILog, TLogContext } from "../../../logging/logger"
import { IExecutableAction, IKubectlAction, TDeploymentOptions } from "../../../deployment-types"
import { extendedExec } from "../../../helpers/promisified"
import { TDeploymentState } from "@shepherdorg/metadata"
import { TDescriptorsByKind } from "../k8s-deployment-document-identifier"
import { IExec, FProvideTime, FTimer } from "../../../helpers/basic-types"

export interface TDeploymentTimeAnnotationActionDependencies {
  exec: IExec,
  logger: ILog
  systemTime: FProvideTime
  timeout: FTimer
}

export interface ICreateDeploymentTimeAnnotationActions {
  createDeploymentTimeAnnotationAction(deploymentDoc: TK8sPartialDescriptor): IKubectlAction
  createDeploymentTimeAnnotationActions(descriptorsByKind?: TDescriptorsByKind): Array<IExecutableAction>
}

export function createDeploymentTimeAnnotationActionFactory(injected: TDeploymentTimeAnnotationActionDependencies):ICreateDeploymentTimeAnnotationActions{

  function createDeploymentTimeAnnotationAction(deploymentDoc: TK8sPartialDescriptor): IKubectlAction {
    let identifier = `${deploymentDoc.kind} ${deploymentDoc.metadata.name}`

    let kubeArgs = ["--namespace", deploymentDoc.metadata.namespace || "default", "annotate", "--overwrite", deploymentDoc.kind, deploymentDoc.metadata.name, `lastDeploymentTimestamp=${injected.systemTime().toISOString()}`]

    function planString() {
      return `kubectl ${kubeArgs.join(" ")}`
    }

    let actionRetryCount=0
    let annotationAction: IKubectlAction = {
      descriptor: planString(),
      identifier: 'deployment timestamp ' + identifier,
      isStateful: false,
      operation: "annotate",
      type: "k8s",
      canRollbackExecution(): boolean {
        return false
      },
      execute(deploymentOptions: TDeploymentOptions & { waitForRollout: boolean; pushToUi: boolean; logContext: TLogContext }): Promise<IExecutableAction> {
        injected.logger.debug(`Executing ${planString()}`)
        return extendedExec(injected.exec)("kubectl", kubeArgs, {
          env: process.env,
          debug: true,
        }).then((stdOut) => {
          injected.logger.info(planString(), deploymentOptions.logContext)
          if(stdOut){
            injected.logger.info(stdOut as string, deploymentOptions.logContext)
          }
          return annotationAction
        }).catch(async (execError) => {
          if(actionRetryCount < 4){
            actionRetryCount++
            await injected.timeout(()=>{}, 500)
            return annotationAction.execute(deploymentOptions)
          } else {
            const { errCode, stdOut, message: err } = execError
            injected.logger.warn(`Error executing ${planString()}, code ${errCode}`, deploymentOptions.logContext)
            injected.logger.warn(err, deploymentOptions.logContext)
            if(stdOut){
              injected.logger.warn(stdOut, deploymentOptions.logContext)
            }
            return annotationAction

          }
        })
      },
      getActionDeploymentState(): TDeploymentState | undefined {
        return undefined
      },
      planString: planString,
      setActionDeploymentState(newState: TDeploymentState | undefined): void {
      },
    }
    return annotationAction
  }

  function createDeploymentTimeAnnotationActions(descriptorsByKind: TDescriptorsByKind) {
    const resultingActions: Array<IExecutableAction> = []
    if (descriptorsByKind) {
      Object.values(descriptorsByKind).forEach((deploymentDocs) => {
        deploymentDocs.forEach((deploymentDoc) => {
          let annotationAction = createDeploymentTimeAnnotationAction(deploymentDoc)

          resultingActions.push(annotationAction)
        })
      })
    }

    return resultingActions
  }

  let exposed : ICreateDeploymentTimeAnnotationActions= {
    createDeploymentTimeAnnotationActions: createDeploymentTimeAnnotationActions,
    createDeploymentTimeAnnotationAction: createDeploymentTimeAnnotationAction
  }
  return exposed
}

