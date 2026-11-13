import { strict as assert } from "node:assert"
import { describe, it, beforeEach } from "node:test"

describe("Herd editing", function() {

  let logInfoEntries;

  beforeEach(()=>{
    logInfoEntries = []
  })

  let logger = {
    info:(message:string)=>{
      logInfoEntries.push(message)
    }
  }

  it("should add herd entry", () => {
    const editedHerd = require("./herd-edit").upgradeOrAddDeployment({
      herd: { images: {} },
      upstreamImageTag: "99",
      upstreamHerdKey: "test88",
      upstreamHerdDescription: "JustATest",
      upstreamImageName: "test88image",
      imageFileName: 'na'
    }, logger)
    assert.strictEqual(editedHerd.images.test88.image, "test88image")
    assert.strictEqual(editedHerd.images.test88.imagetag, "99")
  })

  it("should edit herd entry", () => {
    const editedHerd = require("./herd-edit").upgradeOrAddDeployment({
      herd: {
        images: {
          test88: { image: 'test88image', imagetag: "99", description: 'JustATest' }
        },
      },
      upstreamImageTag: "100",
      upstreamHerdKey: "test88",
      upstreamImageName: "test99image",
      imageFileName: 'na'
    }, logger)
    assert.strictEqual(editedHerd.images.test88.imagetag, "100")
    assert.strictEqual(editedHerd.images.test88.image, "test99image")
  })

  it("should edit description", () => {
    const editedHerd = require("./herd-edit").upgradeOrAddDeployment({
      herd: {
        images: {
          test88: { image: 'test88image', imagetag: "99", description: 'JustATest' }
        },
      },
      upstreamImageTag: "99",
      upstreamHerdKey: "test88",
      upstreamImageName: "test88image",
      imageFileName: 'na',
      upstreamHerdDescription: 'New description'
    }, logger)
    assert.strictEqual(editedHerd.images.test88.description, "New description")
  })
})
