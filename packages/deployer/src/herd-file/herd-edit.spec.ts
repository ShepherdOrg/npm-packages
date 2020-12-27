import { expect } from "chai"

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
    expect(editedHerd.images.test88.image).to.equal("test88image")
    expect(editedHerd.images.test88.imagetag).to.equal("99")
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
    expect(editedHerd.images.test88.imagetag).to.equal("100")
    expect(editedHerd.images.test88.image).to.equal("test99image")
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
    expect(editedHerd.images.test88.description).to.equal("New description")
  })
})
