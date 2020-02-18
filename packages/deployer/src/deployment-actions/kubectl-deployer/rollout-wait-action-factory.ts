import { IExecutableAction, IKubectlAction, ILog, TDeploymentOptions } from "../../deployment-types"
import { TDeploymentState } from "@shepherdorg/metadata"
import { extendedExec } from "../../helpers/promisified"
import { TDeploymentRollout } from "./create-kubectl-deployment-action"

export function RolloutWaitActionFactory(deploymentRollout: TDeploymentRollout): IKubectlAction {

  function planString() {
    return `kubectl --namespace ${deploymentRollout.namespace} rollout status ${deploymentRollout.deploymentKind}/${deploymentRollout.deploymentName}`
  }

  let identifier = `${deploymentRollout.deploymentKind}/${deploymentRollout.deploymentName}`
  const waitAction: IKubectlAction = {

    type: "k8s",
    operation: "rollout",
    identifier: identifier,
    pushToUI: false,
    descriptor: planString(),
    planString: planString,
    execute(deploymentOptions: TDeploymentOptions & { waitForRollout: boolean; pushToUi: boolean }, cmd: any, logger: ILog, _saveDeploymentState: (stateSignatureObject: any) => Promise<TDeploymentState>): Promise<IExecutableAction> {
      if (deploymentOptions.waitForRollout) {
        return extendedExec(cmd)("kubectl", ["--namespace", deploymentRollout.namespace, "rollout", "status", identifier], {
          env: process.env,
          debug: true,
        }).then((stdOut) => {
          logger.info(planString())
          logger.info(stdOut)
          return waitAction
        }).catch((execError) => {
          const { errCode, stdOut, message: err } = execError
          logger.warn(`Error executing kubectl rollout status ${deploymentRollout}, code ${errCode}`)
          logger.warn(err)
          logger.warn(stdOut)
          return waitAction
        })
      } else {
        return Promise.resolve(waitAction)
      }
    }
  }
  return waitAction
}
