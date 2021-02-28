import { createFakeStateStore, TFakeStateStore } from "@shepherdorg/state-store/dist/fake-state-store-factory"
import { createFakeLogger, IFakeLogging } from "../../../test-tools/fake-logger"
import { IStatefulExecutableAction, TActionExecutionOptions } from "../../../deployment-types"
import { expect } from "chai"
import { createDeploymentTimeAnnotationActionFactory } from "./create-deployment-time-annotation-action"
import { defaultTestExecutionOptions } from "../../../test-tools/test-action-execution-options"

const exec = require("@shepherdorg/exec")

xdescribe("Deployment Time Annotation Action - Integrated - Requires access to a running kube cluster", function() {
  describe("For deployment in unspecified namespace", function() {
    let deploymentName = "tjon-service-deployment-domestic-accident"

    let fakeStateStore: TFakeStateStore
    let fakeLogger: IFakeLogging
    let annotationAction: IStatefulExecutableAction
    let execResult: IStatefulExecutableAction

    before(async () => {
      fakeStateStore = createFakeStateStore()
      fakeLogger = createFakeLogger()

      annotationAction = createDeploymentTimeAnnotationActionFactory({
        exec: exec,
        logger: fakeLogger,
        systemTime: () => {
          return new Date("2020-08-26T13:23:42.376Z")
        },
        timeout: setTimeout,
      }).createDeploymentTimeAnnotationAction({
        metadata: { name: deploymentName },
        spec: {},
        kind: "Deployment",
      })

      return (execResult = await annotationAction.execute(defaultTestExecutionOptions))
    })

    it("should log that resource was annotated", () => {
      // fakeLogger.printAllStatements()

      expect(fakeLogger.infoLogEntries[1].data[0].trim()).to.equal(`deployment.extensions/${deploymentName} annotated`)
    })
  })
})
