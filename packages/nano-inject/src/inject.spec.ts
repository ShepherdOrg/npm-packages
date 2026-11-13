import { strict as assert } from "node:assert"
import { describe, it } from "node:test"
import { inject } from "./inject"

describe("inject dependency injection", function() {
  it("should return injected dependency", function() {
    var deps = inject({
      foo: "bar",
    })
    assert.strictEqual(deps("foo"), "bar")
  })

  it("should fail on missing dependency", function() {
    try {
      var deps = inject({
        foo: "bar",
      })
      deps("baz")
    } catch (e) {
      assert.deepStrictEqual(e.message, "Required dependency <baz> is not provided.")
    }
  })

  it("should not fail on optional missing dependency", function() {
    var deps = inject({
      x: "bar",
    })
    assert.strictEqual(deps("foo", true), undefined)
  })
})
