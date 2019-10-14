import {expect} from 'chai'
import path from 'path'

import {FileStore} from './index'

describe('file object store backend', function () {

    let store;

    beforeEach(function () {
        store = FileStore({
            directory: path.join(__dirname, '.teststore')
        });

    });

    it('should persist object', function () {
        return new Promise(function (resolve, reject) {
            store.connect().then(function (_numberOfDeployments) {
                store.set("postgres/deployment", {is: "awesomeToo"}).then(function (savedKeyPair) {
                    expect(savedKeyPair.key).to.eql("postgres/deployment");
                    expect(savedKeyPair.value.is).to.eql("awesomeToo");
                    resolve();
                }).catch(function (setError) {
                    reject(setError);
                })
            }).catch(function (err) {
                reject(err);
            });

        });
    });

    it('should set object', function () {
        return new Promise(function (resolve, reject) {
            store.connect().then(function (_numberOfDeployments) {
                store.set("postgres/deployment", {is: "awesome"}).then(() => {
                    store.get("postgres/deployment").then(function (retrievedKeyPair) {
                        expect(retrievedKeyPair.key).to.eql("postgres/deployment");
                        expect(retrievedKeyPair.value.is).to.eql("awesome");
                        resolve();
                    }).catch(function (setError) {
                        reject(setError);
                    })
                })
            }).catch(reject)
        });
    });

    it('should set object twice', function () {
        return new Promise(function (resolve, reject) {
            store.connect().then(function (_numberOfDeployments) {
                store.set("postgres/deployment", {is: "awesomerrrr"}).then((_writeOne) => {
                    store.set("postgres/deployment", {is: "awesome"}).then((_writeTwoResult) => {
                        store.get("postgres/deployment").then(function (retrievedKeyPair) {
                            expect(retrievedKeyPair.key).to.eql("postgres/deployment");
                            expect(retrievedKeyPair.value.is).to.eql("awesome");
                            resolve();
                        }).catch(reject);
                    }).catch(reject);
                }).catch(reject)
            }).catch(reject);

        });
    });

    it('should return undefined value if state non-existing object', function () {
        return new Promise(function (resolve, reject) {
            store.connect().then(function () {
                store.get("postgres/neverset-deployment").then(function (retrievedKeyPair) {
                        expect(retrievedKeyPair.key).to.eql("postgres/neverset-deployment");
                        expect(retrievedKeyPair.value).to.equal(undefined);
                        resolve();
                    }
                ).catch(function (setError) {
                    reject(setError);
                })
            }).catch(function (err) {
                console.debug("Connect rejected - CATCH");
                reject(err);
            });

        });
    });

    it('should implement disconnect noop', function () {
        return new Promise(function (resolve, reject) {
            store.connect().then(() => {
                store.disconnect().then(function (_retrievedKeyPair) {
                        resolve();
                    }
                ).catch(function (setError) {
                    reject(setError);
                })
            }).catch(function (err) {
                console.debug("Connect rejected - CATCH");
                reject(err);
            });

        });

    });
});
