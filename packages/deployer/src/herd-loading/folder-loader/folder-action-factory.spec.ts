import { strict as assert } from "node:assert"
import { describe, it, before, beforeEach, afterEach } from "node:test"

import { createFolderActionFactory } from "./folder-action-factory"
import { IK8sDirDeploymentAction, TFolderHerdDeclaration, TFolderMetadata } from "../../deployment-types"
import { TFileSystemPath } from "../../helpers/basic-types"
import { TDeploymentType } from "@shepherdorg/metadata"

const Path = require("path")

import Bluebird = require("bluebird")
import { createKubectlDeploymentActionsFactory } from "../../deployment-actions/kubectl-action/kubectl-deployment-action-factory"
import { createFakeLogger } from "@shepherdorg/logger"
import { createFakeStateStore } from "@shepherdorg/state-store/dist/fake-state-store-factory"
import { initFakeExecution } from "@shepherdorg/ts-exec"

type TTestPlan = {
  addedK8sDeploymentActions: { [key: string]: IK8sDirDeploymentAction }
  addDeployment: (deploymentAction: IK8sDirDeploymentAction) => {}
}

describe("k8s deployment file directory structure release plan loader", function() {
  let scanDir: (dir: TFileSystemPath, herdSpec: TFolderHerdDeclaration) => Promise<Array<IK8sDirDeploymentAction>>

  let plan: TTestPlan = {
    addedK8sDeploymentActions: {},
    async addDeployment(deployment) {
      plan.addedK8sDeploymentActions[deployment.identifier] = deployment
      return { fakeState: true }
    },
  }

  beforeEach(function() {
    scanDir = createFolderActionFactory({
      environment: "factory-spec",
      logger: {
        info: () => {},
        warn: () => {},
        debug: () => {},
        error: () => {},
      },
      kubectlDeploymentActionFactory: createKubectlDeploymentActionsFactory({
        exec: initFakeExecution().exec,
        logger: createFakeLogger(),
        stateStore: createFakeStateStore(),
      }),
    }).scanDir
  })

  describe("successful load", function() {
    beforeEach(function() {
      process.env.BRANCH_NAME = "testing-branch"
      process.env.BRANCH_NAME_PREFIX = "testing-prefix."
      process.env.BRANCH_NAME_POSTFIX = "-testing-postfix"
      process.env.SUB_DOMAIN_PREFIX = "testing1234"
      process.env.PREFIXED_TOP_DOMAIN_NAME = "testing12345"
      process.env.EXPORT2 = "testing123"
      process.env.CLUSTER_POLICY_MAX_CPU_REQUEST = "25m"
      process.env.www_icelandair_com_image = "www-icelandair-image:1.0"
      process.env.www_icelandair_com_deleted_image = ""

      let deploymentDirsPath = Path.join(__dirname, "../../testdata/deployment-dirs")

      let fakeHerdSpec: TFolderHerdDeclaration = {
        key: "spec",
        path: deploymentDirsPath,
      }
      return scanDir(deploymentDirsPath, fakeHerdSpec).then(function(plans) {
        return Bluebird.each(plans, function(deploymentPlan) {
          plan.addDeployment(deploymentPlan)
        })
      })
    })

    afterEach(() => {
      delete process.env.BRANCH_NAME
      delete process.env.BRANCH_NAME_PREFIX
      delete process.env.BRANCH_NAME_POSTFIX
      delete process.env.CLUSTER_POLICY_MAX_CPU_REQUEST
    })

    it("should expand env variables in deployment file on load", function() {
      assert.ok(!plan.addedK8sDeploymentActions["Deployment_www-icelandair-com-fromdir"].descriptor.includes("${TPL_DOCKER_IMAGE}"))
    })

    it("should expand env variables in deployment file on load, using handlebars template format", function() {
      assert.ok(!plan.addedK8sDeploymentActions["Deployment_www-icelandair-com-fromdir"].descriptor.includes("{{{TPL_DOCKER_IMAGE}}}"))
      assert.ok(plan.addedK8sDeploymentActions["Deployment_www-icelandair-com-fromdir"].descriptor.includes("secondaryImage: 'www-icelandair-image:1.0'"))
    })

    it("should add origin dir to plan", function() {
      assert.ok(plan.addedK8sDeploymentActions["Service_www-icelandair-com-fromdir"].origin.includes("www-icelandair-com"))
    })

    it("should result in exactly those plans", function() {
      assert.strictEqual(Object.keys(plan.addedK8sDeploymentActions)
          .sort()
          .join(","), "Deployment_www-icelandair-com-deleted,Deployment_www-icelandair-com-fromdir,Namespace_monitors,Service_www-icelandair-com-fromdir,Service_www-icelandair-com-internal-fromdir")
    })

    it("all versions should be immutable", function() {
      assert.strictEqual(plan.addedK8sDeploymentActions["Service_www-icelandair-com-fromdir"].version, "immutable")
    })

    it("default operation should be apply", function() {
      assert.strictEqual(plan.addedK8sDeploymentActions["Service_www-icelandair-com-fromdir"].operation, "apply")
    })

    it("operation of file in directory with delete marker should be delete", function() {
      assert.strictEqual(plan.addedK8sDeploymentActions["Namespace_monitors"].operation, "delete")
    })

    it("should have folder herdspec attached", () => {
      assert.ok(plan.addedK8sDeploymentActions["Namespace_monitors"].herdDeclaration.path.includes("deployment-dirs"))
    })

    it("should apply k8s deployment-time cluster policy", function() {
      assert.ok(plan.addedK8sDeploymentActions["Deployment_www-icelandair-com-fromdir"].descriptor.includes("25m"))
    })

    it("should add k8s deployment to plan for each file under k8s identifier", function() {
      assert.notStrictEqual(plan.addedK8sDeploymentActions["Service_www-icelandair-com-fromdir"], undefined)
    })

    it("should expand folder_name_image as TPL_DOCKER_IMAGE for variable substitution in deployment files", function() {
      assert.ok(plan.addedK8sDeploymentActions["Deployment_www-icelandair-com-fromdir"].descriptor.includes("www-icelandair-image:1.0"))
    })

    it("should mark deployment for delete if folder_name_image variable is set and empty", function() {
      assert.strictEqual(plan.addedK8sDeploymentActions["Deployment_www-icelandair-com-deleted"].operation, "delete")
    })

    describe("file deployment metadata", function() {
      let metadata: TFolderMetadata

      before(() => {
        metadata = plan.addedK8sDeploymentActions["Namespace_monitors"].metadata
      })

      it("should use file modification timestamp as build timestamp (inaccurate test)", () => {
        assert.ok((new Date(metadata.buildDate)) > (new Date("2019-01-01T12:55:01.561Z")))
      })

      it("should use file name as displayname", () => {
        assert.ok(metadata.displayName.includes("monitors-namespace.yml"))
      })

      it("should contain relative path to file", () => {
        assert.strictEqual(metadata.path, "namespaces/monitors-namespace.yml")
      })

      it("should have no semanticVersion", () => {
        assert.strictEqual(metadata.semanticVersion, "none")
      })

      it("should have k8s deployment type", () => {
        assert.strictEqual(metadata.deploymentType, TDeploymentType.Kubernetes)
      })

      it("should not have any hyperlinks", () => {
        assert.strictEqual(metadata.hyperlinks.length, 0)
      })
    })
  })
})
