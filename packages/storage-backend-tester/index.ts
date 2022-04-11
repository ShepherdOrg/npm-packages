import { expect } from "chai"

import { IStorageBackend } from "@shepherdorg/state-store"

export default (backendName: string, createBackend: () => IStorageBackend) => {
  describe(`${backendName} store backend`, function() {
    let store

    this.timeout(70000)
    beforeEach(function() {
      store = createBackend()
    })

    it("should persist object", async function() {
      await store.connect()

      const savedKeyPair = await store.set("postgres/deployment", { is: "awesomeToo" })
      expect(savedKeyPair.key).to.eql("postgres/deployment")
      expect(savedKeyPair.value.is).to.eql("awesomeToo")
    })

    it("should set object", async function() {
      await store.connect()

      await store.set("postgres/deployment", { is: "awesome" })
      const retrievedKeyPair = await store.get("postgres/deployment")
      expect(retrievedKeyPair.key).to.eql("postgres/deployment")
      expect(retrievedKeyPair.value.is).to.eql("awesome")
    })

    it("should set object twice", async function() {
      await store.connect()
      await store.set("postgres/deployment", { is: "awesomerrrr" })
      await store.set("postgres/deployment", { is: "awesome" })
      const retrievedKeyPair = await store.get("postgres/deployment")
      expect(retrievedKeyPair.key).to.eql("postgres/deployment")
      expect(retrievedKeyPair.value.is).to.eql("awesome")
    })

    it("should return undefined value if state non-existing object", async function() {
      await store.connect()
      const retrievedKeyPair = await store.get("postgres/neverset-deployment")
      expect(retrievedKeyPair.key).to.eql("postgres/neverset-deployment")
      expect(retrievedKeyPair.value).to.equal(undefined)
    })

    it("should implement disconnect noop", async function() {
      await store.connect()
      await store.disconnect()
    })
  })
}
