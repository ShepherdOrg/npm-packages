import { PostgresStore } from "./index"

import { expect } from "chai"

describe("postgres object store backend", function() {
  let store

  beforeEach(function() {
    let pgPort = Number(process.env.SHEPHERD_PG_PORT) || 54321
    let pgHost = process.env.SHEPHERD_PG_HOST || "localhost"
    // console.debug(`Connecting to postgres on ${pgHost}:${pgPort}`)
    store = PostgresStore({
      user: "postgres",
      host: pgHost,
      database: "postgres",
      password: process.env.SHEPHERD_PG_PASSWORD || "mysecretpassword",
      port: pgPort,
      schema: "shepherd",
    })
  })

  it("should persist object", function() {
    return new Promise(function(resolve, reject) {
      store
        .connect()
        .then(function(_numberOfDeployments) {
          store
            .set("postgres/deployment", { is: "awesome" })
            .then(function(savedKeyPair) {
              expect(savedKeyPair.key).to.eql("postgres/deployment")
              expect(savedKeyPair.value.is).to.eql("awesome")
              resolve()
            })
            .catch(function(setError) {
              reject(setError)
            })
        })
        .catch(function(err) {
          reject(err)
        })
    })
  })

  it("should set object", function() {
    return new Promise(function(resolve, reject) {
      store
        .connect()
        .then(function(_numberOfDeployments) {
          store
            .set("postgres/deployment", { is: "awesome" })
            .then(
              store.get("postgres/deployment").then(function(retrievedKeyPair) {
                expect(retrievedKeyPair.key).to.eql("postgres/deployment")
                expect(retrievedKeyPair.value.is).to.eql("awesome")
                resolve()
              })
            )
            .catch(function(setError) {
              reject(setError)
            })
        })
        .catch(function(err) {
          reject(err)
        })
    })
  })

  it("should set object twice", function() {
    return new Promise(function(resolve, reject) {
      store
        .connect()
        .then(function(_numberOfDeployments) {
          store
            .set("postgres/deployment", { is: "awesome" })
            .then(
              store
                .set("postgres/deployment", { is: "awesome" })
                .then(
                  store
                    .get("postgres/deployment")
                    .then(function(retrievedKeyPair) {
                      expect(retrievedKeyPair.key).to.eql("postgres/deployment")
                      expect(retrievedKeyPair.value.is).to.eql("awesome")
                      resolve()
                    })
                    .catch(reject)
                )
                .catch(reject)
            )
            .catch(reject)
        })
        .catch(reject)
    })
  })

  it("should return undefined value if state non-existing object", function() {
    return new Promise(function(resolve, reject) {
      return store
        .connect()
        .then(function() {
          store
            .get("postgres/neverset-deployment")
            .then(function(retrievedKeyPair) {
              expect(retrievedKeyPair.key).to.eql(
                "postgres/neverset-deployment"
              )
              expect(retrievedKeyPair.value).to.equal(undefined)
              resolve()
            })
            .catch(function(setError) {
              reject(setError)
            })
        })
        .catch(function(err) {
          console.debug("Connect rejected - CATCH")
          reject(err)
        })
    })
  })
})
