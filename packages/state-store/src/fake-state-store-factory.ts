import { TDeploymentState } from "@shepherdorg/metadata"
import { IReleaseStateStore, TDeploymentStateParams } from "./state-store"

export interface TFakeStateStore extends IReleaseStateStore {
  checkedStates: any[];
  fixedTimestamp: string;
  saveDeploymentState: (deploymentState: TDeploymentState) => Promise<TDeploymentState>;
  nextState: any;
  savedStates: TDeploymentState[];
  getDeploymentState: (deploymentAction: TDeploymentStateParams) => Promise<TDeploymentState>
}

function emptyArray<T>(): Array<T> {
  return []
}

export function createFakeStateStore(): TFakeStateStore {
  let nextState: any = {}
  let checkedStates:any[] = []

  const fakeStateStore = {
    fixedTimestamp: "1999-01-10T00:00:00.000Z",
    nextState: nextState,
    checkedStates: checkedStates,
    savedStates: emptyArray<TDeploymentState>(),
    getDeploymentState: function(deploymentStateParams: TDeploymentStateParams ): Promise<TDeploymentState> {
      checkedStates.push(JSON.parse(JSON.stringify(deploymentStateParams)))
      let value = {
        testState: true,
        new: true,
        modified: true,
        operation: "apply",
        version: "0.0.0",
        lastVersion: undefined,
        signature: "fakesignature",
        origin: deploymentStateParams.origin,
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
    }
  }
  return fakeStateStore
}
