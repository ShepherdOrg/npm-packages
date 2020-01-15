import { expect } from "chai"
import { parseImageUrl } from "./parse-image-url"

describe("docker image url parsing", function() {

  it("should parse full tm url", () => {

    let parsed = parseImageUrl('isrvkbuild02:5000/image-one:1.1-9999')
    if(parsed){
      expect(parsed.image).to.equal('image-one')
      expect(parsed.imagetag).to.equal('1.1-9999')
      expect(parsed.dockerTag).to.equal('1.1-9999')
      expect(parsed.dockerRegistry).to.equal('isrvkbuild02:5000')
      expect(parsed.dockerRepository).to.equal('image-one')
      expect(parsed.dockerNamespace).to.equal('')
    }
  })

  it("should parse regular dockerhub image url", () => {

    let parsed = parseImageUrl('image-one:1.1-9999')
    if(parsed){
      expect(parsed.image).to.equal('image-one')
      expect(parsed.imagetag).to.equal('1.1-9999')
      expect(parsed.dockerTag).to.equal('1.1-9999')
      expect(parsed.dockerRegistry).to.equal('')
      expect(parsed.dockerRepository).to.equal('image-one')
      expect(parsed.dockerNamespace).to.equal('')
    }
  })


  it("should parse regular image url without version tag, defaulting to latest", () => {

    let parsed = parseImageUrl('image-one')
    if(parsed){
      expect(parsed.image).to.equal('image-one')
      expect(parsed.imagetag).to.equal('latest')
      expect(parsed.dockerTag).to.equal('latest')
      expect(parsed.dockerRegistry).to.equal('')
      expect(parsed.dockerRepository).to.equal('image-one')
      expect(parsed.dockerNamespace).to.equal('')
    }
  })

  it("should parse regular image url without version tag, defaulting to latest", () => {

    let parsed = parseImageUrl('registry.com/ubuntu:14.04')
    if(parsed){
      expect(parsed.image).to.equal('ubuntu')
      expect(parsed.imagetag).to.equal('14.04')
      expect(parsed.dockerTag).to.equal('14.04')
      expect(parsed.dockerRegistry).to.equal('registry.com')
      expect(parsed.dockerRepository).to.equal('ubuntu')
      expect(parsed.dockerNamespace).to.equal('')
    }
  })

})
