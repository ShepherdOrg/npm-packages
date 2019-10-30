import { expect } from "chai"
import { inject } from "./inject"

describe("inject dependency injection", function() {
  it("should return injected dependency", function() {
    var deps = inject({
      foo: "bar",
    })
    expect(deps("foo")).to.equal("bar")
  })

  it("should fail on missing dependency", function() {
    try {
      var deps = inject({
        foo: "bar",
      })
      deps("baz")
    } catch (e) {
      expect(e.message).to.eql("Required dependency <baz> is not provided.")
    }
  })

  it("should not fail on optional missing dependency", function() {
    var deps = inject({
      x: "bar",
    })
    expect(deps("foo", true)).to.equal(undefined)
  })
})
