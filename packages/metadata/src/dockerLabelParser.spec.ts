import {
  TDeployerRole,
  TDeploymentType,
  TDeployerMetadata,
  TK8sMetadata,
  TImageMetadata,
} from "./index"
import {
  extractImageLabels,
  extractMetadataFromDockerInspectJson,
  extractShepherdMetadata,
} from "./dockerLabelParser"

import { strict as assert } from "node:assert"
import { describe, it, before } from "node:test"

describe("Shepherd metadata reading", function() {
  describe("from image with no shepherd labels", function() {

    let loadError: Error

    before(async () => {
      try {
        await extractMetadataFromDockerInspectJson(
          "./testdata/inspected-dockers/alpine.json"
        )
      } catch (err) {
        loadError = err
      }
    })

    it("should throw an error", () => {
      assert.ok(loadError.message.includes("No shepherd labels present in docker image Labels {}"))
    })
  })

  describe("from shepherd.metadata label, k8s deployment", function() {
    let metaData: TK8sMetadata

    before(async () => {
      metaData = await extractMetadataFromDockerInspectJson(
        "./testdata/inspected-dockers/public-repo-with-deployment-dir.json"
      )
    })

    it("should contain buildHostName", () => {
      // noinspection BadExpressionStatementJS
      assert.ok(metaData.buildHostName)
    })

    it("should contain dockerImageTag", () => {
      assert.strictEqual(typeof metaData.dockerImageTag, "string")
    })

    // it('should contain gitHash', () => {
    //     expect(metaData.gitHash).to.be.a('string')
    // });

    it("should contain gitUrl", () => {
      assert.strictEqual(metaData.gitUrl, "git@github.com:ShepherdOrg/npm-packages.git")
    })

    it("should contain gitCommit", () => {
      assert.strictEqual(typeof metaData.gitCommit, "string")
    })

    it("should contain lastCommits", () => {
      assert.strictEqual(typeof metaData.lastCommits, "string")
    })

    it("should decode lastCommits base64 string", () => {
      assert.ok(metaData.lastCommits.includes("Metadata updates and a few more fixes"))
    })

    it("should contain kubeConfigB64", () => {
      assert.strictEqual(typeof metaData.kubeConfigB64, "string")
    })

    it("should uncompress string in kubeConfigB64", () => {
      // @ts-ignore
      assert.strictEqual(typeof metaData.kubeDeploymentFiles["./deployment/kube.yaml"].content, "string")
    })
  })

  describe("from docker labels, k8s deployment, old style", function() {
    let metaData: TK8sMetadata

    before(async () => {
      const dockerImageInspection = require("./testdata/inspected-dockers/testenvimage.json")
      const imageLabels = extractImageLabels(dockerImageInspection)
      metaData = await extractShepherdMetadata(imageLabels)
    })

    it("should read shepherd.dbmigration", () => {
      assert.strictEqual(metaData.migrationImage, "testenvimage-migrations:0.0.0")
    })

    it("should read shepherd.kube.config.tar.base64", () => {
      assert.strictEqual(typeof metaData.kubeConfigB64, "string")
    })

    it("should uncompress kubeConfiB64Files", () => {
      assert.strictEqual(typeof metaData.kubeDeploymentFiles, "object")
      // @ts-ignore
      assert.strictEqual(typeof metaData.kubeDeploymentFiles["./deployment/"], "object")
    })

    it("should read shepherd.deployer", () => {
      assert.strictEqual(metaData.deploymentType, TDeploymentType.Kubernetes)
    })

    it("should decode shepherd.lastcommits", () => {
      assert.ok(metaData.lastCommits.includes("Fix base64 encode on last five commits"))
    })

    it("should read shepherd.name", () => {
      assert.strictEqual(metaData.displayName, "Testimage")
    })
  })

  describe("from docker labels, deployer, old style", function() {
    let metaData: TDeployerMetadata

    before(async () => {
      const dockerImageInspection = require("./testdata/inspected-dockers/testenvimage-migrations.json")
      const imageLabels = extractImageLabels(dockerImageInspection)
      metaData = (await extractShepherdMetadata(
        imageLabels
      )) as TDeployerMetadata
    })

    it("should read shepherd.deployer.command", () => {
      assert.strictEqual(metaData.deployCommand, "ls")
    })

    it("should default to install role", () => {
      assert.strictEqual(metaData.deployerRole, "install")
    })

    it("should read shepherd.rollback.command", () => {
      assert.strictEqual(metaData.rollbackCommand, "cat")
    })

    it("should read environment variables expansion string", () => {
      assert.ok(metaData.environmentVariablesExpansionString.includes("MICROSERVICES_POSTGRES_RDS_HOST"))
    })

    it("should set deployer role to install", () => {
      assert.strictEqual(metaData.deployerRole, TDeployerRole.Install)
    })
  })

  // describe('from docker labels, deployer, new style', function () {
  //     let metaData: TShepherdDeployerMetadata
  //
  //     before(async () => {
  //         const dockerImageInspection = require('./testdata/inspected-dockers/testenvimage-migrations.json')
  //         const imageLabels = extractImageLabels(dockerImageInspection)
  //         metaData = await extractShepherdMetadata(imageLabels) as TShepherdDeployerMetadata
  //     })
  //
  //     it('should read shepherd.deployer.command', () => {
  //         expect(metaData.deployCommand).to.equal('ls')
  //     });
  //
  //     it('should read shepherd.rollback.command', () => {
  //         expect(metaData.rollbackCommand).to.equal('cat')
  //     });
  //
  //     it('should read environment variables expansion string', () => {
  //         expect(metaData.environmentVariablesExpansionString).to.contain('MICROSERVICES_POSTGRES_RDS_HOST')
  //     });
  //
  //     it('should set deployer role to install', () => {
  //         expect(metaData.deployerRole).to.equal(TDeployerRole.Install)
  //     });
  //
  // })
})

describe("Load all inspected docker files", function() {
  const installImages = [
    "plain-deployer-repo.json",
    "testenvimage-migrations.json",
    "testenvimage.json",
    "testenvimage2.json",
  ]

  const k8sImages = [
    "public-repo-with-kube-yaml.json",
    "public-repo-with-deployment-dir.json",
  ]

  const invalidImages = ["alpine.json", "image-with-no-shepherd-label.json"]

  async function loadMetadata(fileName:string) {
    const dockerImageInspection = require(`./testdata/inspected-dockers/${fileName}`)
    const imageLabels = extractImageLabels(dockerImageInspection)
    const metaData = (await extractShepherdMetadata(
      imageLabels
    )) as TImageMetadata
    return metaData
  }

  installImages.forEach(fileName => {
    it(`should load ${fileName} without error`, async () => {
      const metaData = (await loadMetadata(fileName)) as TDeployerMetadata

      assert.strictEqual(metaData.deployerRole, "install")
      assert.strictEqual(Boolean(!!metaData.deployerRole), true)
    })
  })

  k8sImages.forEach(fileName => {
    it(`should load ${fileName} without error`, async () => {
      const metaData = (await loadMetadata(fileName)) as TK8sMetadata

      assert.strictEqual(Boolean(metaData.kubeDeploymentFiles), true)
    })
  })

  invalidImages.forEach(fileName => {
    it(`should not load ${fileName} without error`, async () => {
      try {
        const metaData = (await loadMetadata(fileName)) as TK8sMetadata

        assert.strictEqual(Boolean(metaData.kubeDeploymentFiles), true)
      } catch (e) {
        assert.ok(e.message.includes("No shepherd labels present"))
      }
    })
  })
})
