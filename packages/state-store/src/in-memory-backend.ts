import {IStorageBackend} from '../../typescript-types/src/'


interface IInMemoryStorageBackend extends IStorageBackend {
    store(): any
}

export function InMemoryStore(): IInMemoryStorageBackend {
    let store = {};
    return {
        connect() {
            // Noop
        }, disconnect() {
            // Noop
        }, resetAllDeploymentStates() {
            store = {}
        },
        set: function (key, value) {
            return new Promise(function (resolve, _reject) {
                store[key] = value;
                setTimeout(function () {
                    resolve({key: key, value: value});
                }, 0);
            })
        },
        get: function (key) {
            return new Promise(function (resolve, _reject) {
                setTimeout(function () {
                    resolve({key: key, value: store[key]});
                }, 0);
            });
        },
        store: function () {
            return store;
        }
    }
}
