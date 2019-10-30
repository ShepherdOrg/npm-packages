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

const expect = require("chai").expect

describe("Shepherd metadata reading", function() {
  describe("from image with no shepherd labels", function() {
    let metaData: TK8sMetadata

    let loadError: Error

    before(async () => {
      try {
        metaData = await extractMetadataFromDockerInspectJson(
          "./testdata/inspected-dockers/alpine.json"
        )
        console.log("Loaded metadata", metaData)
      } catch (err) {
        loadError = err
      }
    })

    it("should throw an error", () => {
      expect(loadError.message).to.contain(
        "No shepherd labels present in docker image Labels {}"
      )
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
      expect(metaData.buildHostName).to.be.ok
    })

    it("should contain dockerImageTag", () => {
      expect(metaData.dockerImageTag).to.be.a("string")
    })

    // it('should contain gitHash', () => {
    //     expect(metaData.gitHash).to.be.a('string')
    // });

    it("should contain gitUrl", () => {
      expect(metaData.gitUrl).to.equal(
        "git@github.com:ShepherdOrg/npm-packages.git"
      )
    })

    it("should contain gitCommit", () => {
      expect(metaData.gitCommit).to.be.a("string")
    })

    it("should contain lastCommits", () => {
      expect(metaData.lastCommits).to.be.a("string")
    })

    it("should decode lastCommits base64 string", () => {
      expect(metaData.lastCommits).to.contain(
        "Introducing npm installable build docker script"
      )
    })

    it("should contain kubeConfigB64", () => {
      expect(metaData.kubeConfigB64).to.be.a("string")
    })

    it("should uncompress string in kubeConfigB64", () => {
      expect(
        metaData.kubeDeploymentFiles["./deployment/kube.yaml"].content
      ).to.be.a("string")
    })

    xit("TODO should read hyperlinks", () => {
      if (metaData.hyperlinks) {
        expect(metaData.hyperlinks.length).to.equal(1)
      } else {
        expect.fail("Should have hyperlinks property")
      }
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
      expect(metaData.migrationImage).to.equal("testenvimage-migrations:0.0.0")
    })

    it("should read shepherd.kube.config.tar.base64", () => {
      expect(metaData.kubeConfigB64).to.be.a("string")
    })

    it("should uncompress kubeConfiB64Files", () => {
      expect(metaData.kubeDeploymentFiles).to.be.a("object")
      expect(metaData.kubeDeploymentFiles["./deployment/"]).to.be.a("object")
    })

    it("should read shepherd.deployer", () => {
      expect(metaData.deploymentType).to.equal(TDeploymentType.Kubernetes)
    })

    it("should decode shepherd.lastcommits", () => {
      expect(metaData.lastCommits).to.include(
        "Rewrite labels in metadata rather than using or statements"
      )
    })

    it("should read shepherd.name", () => {
      expect(metaData.displayName).to.equal("Testimage")
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
      expect(metaData.deployCommand).to.equal("ls")
    })

    it("should default to install role", () => {
      expect(metaData.deployerRole).to.equal("install")
    })

    it("should read shepherd.rollback.command", () => {
      expect(metaData.rollbackCommand).to.equal("cat")
    })

    it("should read environment variables expansion string", () => {
      expect(metaData.environmentVariablesExpansionString).to.contain(
        "MICROSERVICES_POSTGRES_RDS_HOST"
      )
    })

    it("should set deployer role to install", () => {
      expect(metaData.deployerRole).to.equal(TDeployerRole.Install)
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
    "test-infrastructure.json",
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

  async function loadMetadata(fileName) {
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

      expect(metaData.deployerRole).to.equal("install")
      expect(Boolean(!!metaData.deployerRole)).to.equal(true)
    })
  })

  k8sImages.forEach(fileName => {
    it(`should load ${fileName} without error`, async () => {
      const metaData = (await loadMetadata(fileName)) as TK8sMetadata

      expect(Boolean(metaData.kubeDeploymentFiles)).to.equal(true)
    })
  })

  invalidImages.forEach(fileName => {
    it(`should not load ${fileName} without error`, async () => {
      try {
        const metaData = (await loadMetadata(fileName)) as TK8sMetadata

        expect(Boolean(metaData.kubeDeploymentFiles)).to.equal(true)
      } catch (e) {
        expect(e.message).to.contain("No shepherd labels present")
      }
    })
  })
})
