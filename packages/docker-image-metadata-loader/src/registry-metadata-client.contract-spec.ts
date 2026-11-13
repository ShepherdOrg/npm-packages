import {
  createDockerRegistryClient,
  TDockerImageLabels,
} from "./registry-metadata-client"
import { strict as assert } from "node:assert"
import { describe, it } from "node:test"

describe("Registry metadata API against localhost on http", function() {

  const api = createDockerRegistryClient({
    httpProtocol: "http",
    registryHost: "localhost:5000",
  })

  it("should retrieve image tags", () => {
    return api.getImageTags("localhost:5000/shepherd").then(imageWithTags => {
      assert.strictEqual(imageWithTags.name, "shepherd")
      assert.ok(imageWithTags.tags.length >= 1)
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
        assert.deepStrictEqual(Object.getOwnPropertyNames(manifest), expectedPropNames)
      })
  })

  it("should retrieve docker tags on existing image", () => {
    return api
      .getImageManifestLabels("localhost:5000/shepherd", "latest")
      .then((dockerTags: TDockerImageLabels) => {
        assert.strictEqual(dockerTags["shepherd.name"], "Shepherd agent")
      })
  })

  it("should return empty object on image with no docker labels", () => {
    return api
      .getImageManifestLabels("localhost:5000/alpine", "3.4")
      .then((dockerTags: TDockerImageLabels) => {
        assert.deepStrictEqual(dockerTags, {})
      })
  })

  it("should give meaningful error on non-existing image", async () => {
    await api
      .getImageManifestLabels("localhost:5000/nowayjose", "latest")
      .catch(err => {
        assert.strictEqual(err.message.trim(), 'localhost:5000/nowayjose:latest 404: {"errors":[{"code":"MANIFEST_UNKNOWN","message":"manifest unknown","detail":{"Tag":"latest"}}]}')
      })
  })
})

describe("Registry metadata API against localhost with basicauth on https", function() {
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
      assert.strictEqual(imageWithTags.name, "shepherd")
      assert.ok(imageWithTags.tags.length >= 1)
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
        assert.deepStrictEqual(Object.getOwnPropertyNames(manifest), expectedPropNames)
      })
  })

  it("should retrieve docker tags on existing image", () => {
    return httpsApi
      .getImageManifestLabels(`${dockerHost}/shepherd`, "latest")
      .then((dockerTags: TDockerImageLabels) => {
        assert.strictEqual(dockerTags["shepherd.name"], "Shepherd agent")
      })
  })
})
