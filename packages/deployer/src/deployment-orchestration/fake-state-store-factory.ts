import { emptyArray } from "../helpers/ts-functions"
import { TDeploymentState } from "@shepherdorg/metadata"
import { IAnyDeploymentAction } from "../deployment-types"

export type TFakeStateStore = {
  checkedStates: any[];
  storeDeploymentDirState: (_deployment: any) => void;
  fixedTimestamp: string;
  saveDeploymentState: (deploymentState: TDeploymentState) => Promise<TDeploymentState>;
  nextState: any;
  savedStates: TDeploymentState[];
  getDeploymentState: (deploymentAction: IAnyDeploymentAction) => Promise<TDeploymentState>
}

export function createFakeStateStore(): TFakeStateStore {
  let nextState: any = {}
  let checkedStates = emptyArray<any>()

  const fakeStateStore = {
    fixedTimestamp: "1999-01-10T00:00:00.000Z",
    nextState: nextState,
    checkedStates: checkedStates,
    savedStates: emptyArray<TDeploymentState>(),
    getDeploymentState: function(deploymentAction: IAnyDeploymentAction): Promise<TDeploymentState> {
      checkedStates.push(JSON.parse(JSON.stringify(deploymentAction)))
      let value = {
        testState: true,
        new: true,
        modified: true,
        operation: "apply",
        version: "0.0.0",
        lastVersion: undefined,
        signature: "fakesignature",
        origin: deploymentAction.origin,
        env: "UNITTEST",
        timestamp: fakeStateStore.fixedTimestamp,
        ...fakeStateStore.nextState,
      }
      return Promise.resolve(value)
    },
    saveDeploymentState: function(deploymentState: TDeploymentState):Promise<TDeploymentState> {
      return new Promise(function(resolve, reject) {
        if (fakeStateStore.nextState.saveFailure) {
          reject(new Error(fakeStateStore.nextState.message))
          return
        }

        fakeStateStore.savedStates.push(deploymentState)
        resolve(deploymentState)
      })
    },
    storeDeploymentDirState: function(_deployment: any) {
      throw new Error("Not supported in fake state store storeDeploymentDirState")
    },
  }
  return fakeStateStore
}
