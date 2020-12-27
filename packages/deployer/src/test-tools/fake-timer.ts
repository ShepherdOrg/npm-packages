import { FTimer } from "../helpers/basic-types"

export function createFakeTimeoutWrapper() {
  let requestedTimeoutMillis: number

  requestedTimeoutMillis = -1

  let fakeTimeout: FTimer = (callback, millis) => {
    requestedTimeoutMillis = millis
    return setTimeout(callback, 0)
  }
  return {fakeTimeout, lastRequestedTimeoutMillis: ()=>requestedTimeoutMillis}
}

export type TFakeTimeoutWrapper = { lastRequestedTimeoutMillis: ()=>number; fakeTimeout: FTimer }
