import { expect } from "chai"

import { planFolderDeployment } from "./folder-deployment-planner"
import { IK8sDirDeploymentAction, TFolderHerdDeclaration, TFolderMetadata } from "../../deployment-types"
import { TFileSystemPath } from "../../helpers/basic-types"
import { TDeploymentType } from "@shepherdorg/metadata"

const Path = require("path")

import Bluebird = require("bluebird")
import { createKubectlDeploymentActionFactory } from "../../deployment-actions/kubectl-action/create-kubectl-deployment-action"
import { createFakeExec } from "../../test-tools/fake-exec"
import { createFakeLogger } from "../../test-tools/fake-logger"
import { createFakeStateStore } from "@shepherdorg/state-store/dist/fake-state-store-factory"

type TTestPlan = {
  addedK8sDeploymentActions: { [key:string]: IK8sDirDeploymentAction}
  addDeployment: (deploymentAction: IK8sDirDeploymentAction)=>{}
}

describe("k8s deployment file directory structure release plan loader", function() {
  let  scanDir: (dir: (TFileSystemPath), herdSpec:TFolderHerdDeclaration) => Promise<Array<IK8sDirDeploymentAction>>

  let plan: TTestPlan = {
    addedK8sDeploymentActions: {},
    async addDeployment(deployment) {
        plan.addedK8sDeploymentActions[deployment.identifier] = deployment
        return { fakeState: true }
    },
  }

  beforeEach(function() {
    scanDir = planFolderDeployment({
      kubeSupportedExtensions: {
        ".yml": true,
        ".yaml": true,
        ".json": true,
      },
      logger: {
        info: () => {
        },
        warn: () => {
        },
        debug: () => {
        },
        error: () => {
        },
      },
      kubectlDeploymentActionFactory: createKubectlDeploymentActionFactory({
        exec: createFakeExec(),
        logger: createFakeLogger(),
        stateStore: createFakeStateStore()
      })
    } ).scanDir
  })

  describe("successful load", function() {
    beforeEach(function() {
      process.env.SUB_DOMAIN_PREFIX = "testing1234"
      process.env.PREFIXED_TOP_DOMAIN_NAME = "testing12345"
      process.env.EXPORT2 = "testing123"
      process.env.CLUSTER_POLICY_MAX_CPU_REQUEST = "25m"
      process.env.www_icelandair_com_image = "www-icelandair-image:1.0"
      process.env.www_icelandair_com_deleted_image = ""

      let deploymentDirsPath = Path.join(
        __dirname,
        "../../testdata/deployment-dirs"
      )

      let fakeHerdSpec:TFolderHerdDeclaration = {
        key: "spec", path: deploymentDirsPath
      }
      return scanDir(deploymentDirsPath, fakeHerdSpec).then(function(plans) {
        return Bluebird.each(plans, function(deploymentPlan) {
          plan.addDeployment(deploymentPlan)
        })
      })
    })

    afterEach(()=>{
      delete process.env.CLUSTER_POLICY_MAX_CPU_REQUEST
    })

    it("should expand env variables in deployment file on load", function() {
      expect(
        plan.addedK8sDeploymentActions["Deployment_www-icelandair-com-fromdir"]
          .descriptor
      ).not.to.contain("${TPL_DOCKER_IMAGE}")
    })

    it("should expand env variables in deployment file on load, using handlebars template format", function() {
      expect(
        plan.addedK8sDeploymentActions["Deployment_www-icelandair-com-fromdir"]
          .descriptor
      ).not.to.contain("{{{TPL_DOCKER_IMAGE}}}")
      expect(
        plan.addedK8sDeploymentActions["Deployment_www-icelandair-com-fromdir"]
          .descriptor
      ).to.contain("secondaryImage: 'www-icelandair-image:1.0'")
    })

    it("should add origin dir to plan", function() {
      expect(
        plan.addedK8sDeploymentActions["Service_www-icelandair-com-fromdir"].origin
      ).to.contain("www-icelandair-com")
    })

    it("should result in exactly those plans", function() {
      expect(
        Object.keys(plan.addedK8sDeploymentActions)
          .sort()
          .join(",")
      ).to.equal(
        "Deployment_www-icelandair-com-deleted,Deployment_www-icelandair-com-fromdir,Namespace_monitors,Service_www-icelandair-com-fromdir,Service_www-icelandair-com-internal-fromdir"
      )
    })

    it("all versions should be immutable", function() {
      expect(
        plan.addedK8sDeploymentActions["Service_www-icelandair-com-fromdir"].version
      ).to.equal("immutable")
    })

    it("default operation should be apply", function() {
      expect(
        plan.addedK8sDeploymentActions["Service_www-icelandair-com-fromdir"].operation
      ).to.equal("apply")
    })

    it("operation of file in directory with delete marker should be delete", function() {
      expect(plan.addedK8sDeploymentActions["Namespace_monitors"].operation).to.equal(
        "delete"
      )
    })

    it("should have folder herdspec attached", () => {
      expect(plan.addedK8sDeploymentActions["Namespace_monitors"].herdDeclaration.path).to.contain(
        "deployment-dirs"
      )
    })


    it("should apply k8s deployment-time cluster policy", function() {
      expect(
        plan.addedK8sDeploymentActions["Deployment_www-icelandair-com-fromdir"]
          .descriptor
      ).to.contain("25m")
    })

    it("should add k8s deployment to plan for each file under k8s identifier", function() {
      expect(
        plan.addedK8sDeploymentActions["Service_www-icelandair-com-fromdir"]
      ).not.to.equal(undefined)
    })

    it("should expand folder_name_image as TPL_DOCKER_IMAGE for variable substitution in deployment files", function() {
      expect(
        plan.addedK8sDeploymentActions["Deployment_www-icelandair-com-fromdir"]
          .descriptor
      ).to.contain("www-icelandair-image:1.0")
    })

    it("should mark deployment for delete if folder_name_image variable is set and empty", function() {
      expect(
        plan.addedK8sDeploymentActions["Deployment_www-icelandair-com-deleted"]
          .operation
      ).to.equal("delete")
    })

    describe("file deployment metadata", function() {
      let metadata: TFolderMetadata

      before(()=>{
        metadata = plan.addedK8sDeploymentActions["Namespace_monitors"].metadata
      })

      it("should use file modification timestamp as build timestamp (inaccurate test)", () => {
        expect(new Date(metadata.buildDate)).to.be.gt(new Date("2019-01-01T12:55:01.561Z")
        )
      })

      it("should use file name as displayname", () => {
        expect(metadata.displayName).to.contain(
          "monitors-namespace.yml"
        )
      })

      it("should contain relative path to file", () => {
        expect(metadata.path).to.equal('namespaces/monitors-namespace.yml')
      })

      it("should have no semanticVersion", () => {
        expect(metadata.semanticVersion).to.equal('none')
      })

      it("should have k8s deployment type", () => {
        expect(metadata.deploymentType).to.equal(TDeploymentType.Kubernetes)
      })

      it("should not have any hyperlinks", () => {
        expect(metadata.hyperlinks.length).to.equal(0)
      })

    })

  })
})
