// TODO: Create independent tests for this. Test exception handling. Add timeout specification, test timeout handling. Need support in fake kubectl
import { IExecutableAction, ILog, TDeploymentOptions } from "../../deployment-types"
import { TDeploymentState } from "@shepherdorg/metadata"
import { extendedExec } from "../../helpers/promisified"

export function RolloutWaitActionFactory(deploymentRollout: string): IExecutableAction {

  function planString() {
    return `kubectl rollout status ${deploymentRollout}`
  }

  const waitAction: IExecutableAction = {
    pushToUI: false,
    descriptor: deploymentRollout,
    planString: planString,
    execute(deploymentOptions: TDeploymentOptions & { waitForRollout: boolean; pushToUi: boolean }, cmd: any, logger: ILog, _saveDeploymentState: (stateSignatureObject: any) => Promise<TDeploymentState>): Promise<IExecutableAction> {
      if (deploymentOptions.waitForRollout) {
        return extendedExec(cmd)("kubectl", ["rollout", "status", deploymentRollout], {
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
    },
  }
  return waitAction
}
