import { strict as assert } from "node:assert"
import { describe, it } from "node:test"
import { parseImageUrl } from "./parse-image-url"

describe("docker image url parsing", function() {

  it("should parse full tm url", () => {

    let parsed = parseImageUrl('isrvkbuild02:5000/image-one:1.1-9999')
    if(parsed){
      assert.strictEqual(parsed.image, 'image-one')
      assert.strictEqual(parsed.imagetag, '1.1-9999')
      assert.strictEqual(parsed.dockerTag, '1.1-9999')
      assert.strictEqual(parsed.dockerRegistry, 'isrvkbuild02:5000')
      assert.strictEqual(parsed.dockerRepository, 'image-one')
      assert.strictEqual(parsed.dockerNamespace, '')
    }
  })

  it("should parse regular dockerhub image url", () => {

    let parsed = parseImageUrl('image-one:1.1-9999')
    if(parsed){
      assert.strictEqual(parsed.image, 'image-one')
      assert.strictEqual(parsed.imagetag, '1.1-9999')
      assert.strictEqual(parsed.dockerTag, '1.1-9999')
      assert.strictEqual(parsed.dockerRegistry, '')
      assert.strictEqual(parsed.dockerRepository, 'image-one')
      assert.strictEqual(parsed.dockerNamespace, '')
    }
  })


  it("should parse regular image url without version tag, defaulting to latest", () => {

    let parsed = parseImageUrl('image-one')
    if(parsed){
      assert.strictEqual(parsed.image, 'image-one')
      assert.strictEqual(parsed.imagetag, 'latest')
      assert.strictEqual(parsed.dockerTag, 'latest')
      assert.strictEqual(parsed.dockerRegistry, '')
      assert.strictEqual(parsed.dockerRepository, 'image-one')
      assert.strictEqual(parsed.dockerNamespace, '')
    }
  })

  it("should parse regular image url without version tag, defaulting to latest", () => {

    let parsed = parseImageUrl('registry.com/ubuntu:14.04')
    if(parsed){
      assert.strictEqual(parsed.image, 'ubuntu')
      assert.strictEqual(parsed.imagetag, '14.04')
      assert.strictEqual(parsed.dockerTag, '14.04')
      assert.strictEqual(parsed.dockerRegistry, 'registry.com')
      assert.strictEqual(parsed.dockerRepository, 'ubuntu')
      assert.strictEqual(parsed.dockerNamespace, '')
    }
  })

})
