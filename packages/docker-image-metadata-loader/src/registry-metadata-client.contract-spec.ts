import {
  createDockerRegistryClient,
  TDockerImageLabels,
} from "./registry-metadata-client"
import { expect } from "chai"

describe("Registry metadata API against localhost on http", function() {
  this.timeout(60000)

  const api = createDockerRegistryClient({
    httpProtocol: "http",
    registryHost: "localhost:5000",
  })

  it("should retrieve image tags", () => {
    return api.getImageTags("localhost:5000/shepherd").then(imageWithTags => {
      expect(imageWithTags.name).to.equal("shepherd")
      expect(imageWithTags.tags.length).to.be.gte(1)
    })
  })

  it("should have expected property names on manifest", () => {
    return api
      .getImageManifest("localhost:5000/shepherd", "latest")
      .then((manifest: any) => {
        const expectedPropNames = [
          "schemaVersion",
          "name",
          "tag",
          "architecture",
          "fsLayers",
          "history",
          "signatures",
        ]
        expect(Object.getOwnPropertyNames(manifest)).to.eql(expectedPropNames)
      })
  })

  it("should retrieve docker tags on existing image", () => {
    return api
      .getImageManifestLabels("localhost:5000/shepherd", "latest")
      .then((dockerTags: TDockerImageLabels) => {
        expect(dockerTags["shepherd.name"]).to.equal("Shepherd agent")
      })
  })

  it("should return empty object on image with no docker labels", () => {
    return api
      .getImageManifestLabels("localhost:5000/alpine", "3.4")
      .then((dockerTags: TDockerImageLabels) => {
        expect(dockerTags).to.eql({})
      })
  })

  it("should give meaningful error on non-existing image", () => {
    return api
      .getImageManifestLabels("localhost:5000/nowayjose", "latest")
      .catch(err => {
        expect(err.message.trim()).to.equal(
          'localhost:5000/nowayjose:latest 404: {"errors":[{"code":"MANIFEST_UNKNOWN","message":"manifest unknown","detail":{"Tag":"latest"}}]}'
        )
      })
  })
})

describe("Registry metadata API against localhost with basicauth on https", function() {
  this.timeout(60000)
  const dockerHost = "localhost:5500"

  const httpsApi = createDockerRegistryClient({
    httpProtocol: "https",
    registryHost: "localhost:5500",
    authorization: {
      type: "Basic",
      token: "dGVzdHVzZXI6dGVzdHBhc3N3b3Jk",
    },
  })

  it("should retrieve image tags", () => {
    return httpsApi.getImageTags("localhost:5500/shepherd").then(imageWithTags => {
      expect(imageWithTags.name).to.equal("shepherd")
      expect(imageWithTags.tags.length).to.be.gte(1)
    })
  })

  it("should have expected property names on manifest", () => {
    return httpsApi
      .getImageManifest(`${dockerHost}/shepherd`, "latest")
      .then((manifest: any) => {
        const expectedPropNames = [
          "schemaVersion",
          "name",
          "tag",
          "architecture",
          "fsLayers",
          "history",
          "signatures",
        ]
        expect(Object.getOwnPropertyNames(manifest)).to.eql(expectedPropNames)
      })
  })

  it("should retrieve docker tags on existing image", () => {
    return httpsApi
      .getImageManifestLabels(`${dockerHost}/shepherd`, "latest")
      .then((dockerTags: TDockerImageLabels) => {
        expect(dockerTags["shepherd.name"]).to.equal("Shepherd agent")
      })
  })
})
