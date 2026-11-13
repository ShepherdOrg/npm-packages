import { strict as assert } from "node:assert"
import { describe, it, beforeEach } from "node:test"

import { IStorageBackend } from "@shepherdorg/state-store"

export default (backendName: string, createBackend: () => IStorageBackend) => {
  describe(`${backendName} store backend`, function() {
    let store

    beforeEach(function() {
      store = createBackend()
    })

    it("should persist object", async function() {
      await store.connect()

      const savedKeyPair = await store.set("postgres/deployment", { is: "awesomeToo" })
      assert.deepStrictEqual(savedKeyPair.key, "postgres/deployment")
      assert.deepStrictEqual(savedKeyPair.value.is, "awesomeToo")
    })

    it("should set object", async function() {
      await store.connect()

      await store.set("postgres/deployment", { is: "awesome" })
      const retrievedKeyPair = await store.get("postgres/deployment")
      assert.deepStrictEqual(retrievedKeyPair.key, "postgres/deployment")
      assert.deepStrictEqual(retrievedKeyPair.value.is, "awesome")
    })

    it("should set object twice", async function() {
      await store.connect()
      await store.set("postgres/deployment", { is: "awesomerrrr" })
      await store.set("postgres/deployment", { is: "awesome" })
      const retrievedKeyPair = await store.get("postgres/deployment")
      assert.deepStrictEqual(retrievedKeyPair.key, "postgres/deployment")
      assert.deepStrictEqual(retrievedKeyPair.value.is, "awesome")
    })

    it("should return undefined value if state non-existing object", async function() {
      await store.connect()
      const retrievedKeyPair = await store.get("postgres/neverset-deployment")
      assert.deepStrictEqual(retrievedKeyPair.key, "postgres/neverset-deployment")
      assert.strictEqual(retrievedKeyPair.value, undefined)
    })

    it("should implement disconnect noop", async function() {
      await store.connect()
      await store.disconnect()
    })
  })
}
