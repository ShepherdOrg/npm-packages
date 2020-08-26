import { TK8sPartialDescriptor } from "../k8s-document-types"
import { ILog, TLogContext } from "../../../logging/logger"
import { IExecutableAction, IKubectlAction, TDeploymentOptions } from "../../../deployment-types"
import { extendedExec } from "../../../helpers/promisified"
import { TDeploymentState } from "@shepherdorg/metadata"
import { TDescriptorsByKind } from "../k8s-deployment-document-identifier"
import { IExec } from "../../../helpers/basic-types"

export interface TTLAnnotationActionDependencies {
  exec: IExec,
  logger: ILog
}

export interface ICreateTTLAnnotationActions {
  createTTLAnnotationAction(deploymentDoc: TK8sPartialDescriptor): IKubectlAction
  createTTLAnnotationActions(descriptorsByKind?: TDescriptorsByKind): Array<IExecutableAction>
}

export function createTTLAnnotationActionFactory(injected: TTLAnnotationActionDependencies):ICreateTTLAnnotationActions{

  function createTTLAnnotationAction(deploymentDoc: TK8sPartialDescriptor): IKubectlAction {
    let identifier = `${deploymentDoc.kind} ${deploymentDoc.metadata.name}`

    let kubeArgs = ["--namespace", deploymentDoc.metadata.namespace || "default", "annotate", "--overwrite", identifier, `lastDeploymentTimestamp=${new Date().toISOString()}`]

    function planString() {
      return `kubectl ${kubeArgs.join(" ")}`
    }

    let annotationAction: IKubectlAction = {
      descriptor: planString(),
      identifier: 'ttl annotate ' + identifier,
      isStateful: false,
      operation: "annotate",
      type: "k8s",
      canRollbackExecution(): boolean {
        return false
      },
      execute(deploymentOptions: TDeploymentOptions & { waitForRollout: boolean; pushToUi: boolean; logContext: TLogContext }): Promise<IExecutableAction> {
        return extendedExec(injected.exec)("kubectl", kubeArgs, {
          env: process.env,
          debug: true,
        }).then((stdOut) => {
          injected.logger.info(planString(), deploymentOptions.logContext)
          injected.logger.info(stdOut as string, deploymentOptions.logContext)
          return annotationAction
        }).catch((execError) => {
          const { errCode, stdOut, message: err } = execError
          injected.logger.warn(`Error executing ${planString()}, code ${errCode}`, deploymentOptions.logContext)
          injected.logger.warn(err, deploymentOptions.logContext)
          injected.logger.warn(stdOut, deploymentOptions.logContext)
          return annotationAction
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

  function createTTLAnnotationActions(descriptorsByKind: TDescriptorsByKind) {
    const resultingActions: Array<IExecutableAction> = []
    if (descriptorsByKind) {
      Object.values(descriptorsByKind).forEach((deploymentDocs) => {
        deploymentDocs.forEach((deploymentDoc) => {
          let annotationAction = createTTLAnnotationAction(deploymentDoc)

          resultingActions.push(annotationAction)
        })
      })
    }

    return resultingActions
  }

  let exposed : ICreateTTLAnnotationActions= {
    createTTLAnnotationActions: createTTLAnnotationActions,
    createTTLAnnotationAction
  }
  return exposed
}

