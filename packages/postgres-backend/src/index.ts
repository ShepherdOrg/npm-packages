import {IStorageBackend} from '@shepherdorg/typescript-types'

const pg = require('pg');

export interface IPostgresStorageBackend extends IStorageBackend{
    resetAllDeploymentStates()
}

export function PostgresStore(config):IPostgresStorageBackend {
    let client;

    return {
        connect: function () {
            return new Promise(function (resolve, reject) {
                try {
                    client = new pg.Client(config);

                    client.connect(function (err) {
                        if (err) throw err;

                        // execute a query on our database
                        client.query('SELECT count(*) from deployments', [], function (err, result) {
                            if (err) {
                                console.debug("Barbaric built-in migration...attempt to create deployments table");
                                client.query("CREATE TABLE deployments (identifier TEXT PRIMARY KEY, data JSONB, lastdeployment TIMESTAMP NOT NULL);", [], function (err) {
                                    if (err) {
                                        // console.debug("ERROR creating table", err);
                                        reject("Error creating deployments table" + err);
                                    } else {
                                        console.debug("Created deployments table");
                                        resolve(0);
                                    }
                                });
                            } else {
                                // just print the result to the console
                                resolve(result.rows[0].count);
                            }
                        });
                    });
                } catch (e) {
                    // console.debug("Caught exception", e);
                    reject(e);
                }
            });
        },
        disconnect() {
            client.end();
        },
        resetAllDeploymentStates() {
            return new Promise(function (resolve, reject) {
                if (!(process.env.RESET_FOR_REAL === "yes-i-really-want-to-drop-deployments-table")) {
                    reject("RESET_FOR_REAL must be set to true");
                } else {
                    client.query('DROP TABLE deployments', [], function (err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    })
                }

            })
        },
        set: function (key, value) {
            return new Promise(function (resolve, reject) {
                // console.debug("Setting value", key, value);
                client.query('SELECT identifier, data FROM deployments WHERE identifier=$1::text', [key], function (err, result) {
                    if (err) {
                        // console.debug("Error checking value of ", key, value);
                        reject(err);
                    } else {
                        // console.debug("SELECT result is", result);
                        if (result.rows.length === 0) {
                            client.query("INSERT INTO deployments (data, identifier, lastdeployment) VALUES ($1::jsonb, $2::text, $3::timestamp)", [value, key, new Date()], function (err) {
                                if (err) {
                                    console.error("Error INSERTING value ", key, value);
                                    reject(err);
                                } else {
                                    // console.debug("INSERT successful");
                                    resolve({key: key, value: value})
                                }
                            });
                        } else if (result.rows.length === 1) {
                            client.query("UPDATE deployments SET data = $1::jsonb, lastdeployment = $3::timestamp WHERE identifier = $2::text", [value, key, new Date()], function (err) {
                                if (err) {
                                    console.error("Error UPDATING value of ", key, value);
                                    reject(err);
                                } else {
                                    // console.debug("UPDATE successful");
                                    resolve({key: key, value: value})
                                }
                            });
                        } else {
                            reject(new Error(`Too many rows with identifer ${key} : ${result.rows.length}`));
                        }
                    }
                })
            })
        },
        get: function (key) {
            return new Promise(function (resolve, reject) {
                client.query('SELECT identifier, data FROM deployments WHERE identifier=$1::text', [key], function (err, result) {
                    if (err) {
                        reject(err);
                    } else {
                        if (result.rows.length === 0) {
                            resolve({key: key, value: undefined})
                        } else if (result.rows.length === 1) {
                            resolve({key: key, value: result.rows[0].data});
                        } else {
                            reject(new Error(`Too many rows with identifer ${key} : ${result.rows.length}`))
                        }
                    }
                })
            });
        }
    }
}
