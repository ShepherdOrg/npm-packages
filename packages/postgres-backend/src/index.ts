import { IStorageBackend } from "@shepherdorg/state-store"
import { PGConnectionConfig } from "./pg-config"

export { PgConfig } from "./pg-config"

import {Client} from "pg"

export interface IPostgresStorageBackend extends IStorageBackend {
  resetAllDeploymentStates()
}

const StoreClient = (client: Client) => ({
  connect() {
    return new Promise((resolve, reject) => {
      client.connect(function(err) {
        if (err) reject(err)
        else resolve()
      })
    })
  },
  end() {
    return client.end()
  },
  query(query: string, variables: any[] = []) {
    return new Promise((resolve, reject) => {
      client.query(query, variables, (err, result) => (err ? reject(err) : resolve(result)))
    })
  },
})

export function PostgresStore(config: PGConnectionConfig): IPostgresStorageBackend {
  let client

  return {
    async connect() {
      client = StoreClient(new Client(config))
      await client.connect()
      if (config.schema) {
        await client.query(`CREATE SCHEMA IF NOT EXISTS ${config.schema} AUTHORIZATION ${config.user};`)
        await client.query(`SET search_path TO ${config.schema}`)
      }
      await client.query(
        "CREATE TABLE IF NOT EXISTS deployments (identifier TEXT PRIMARY KEY, data JSONB, lastdeployment TIMESTAMP NOT NULL)"
      )
    },
    async disconnect() {
      client.end()
    },
    async resetAllDeploymentStates() {
      if (!(process.env.RESET_FOR_REAL === "yes-i-really-want-to-drop-deployments-table")) {
        throw "RESET_FOR_REAL must be set to true"
      } else {
        return client.query("DROP TABLE deployments")
      }
    },
    async set(key, value) {
      const result = await client.query("SELECT identifier, data FROM deployments WHERE identifier=$1::text", [key])
      if (result.rows.length === 0) {
        try {
          await client.query(
            "INSERT INTO deployments (data, identifier, lastdeployment) VALUES ($1::jsonb, $2::text, $3::timestamp)",
            [value, key, new Date()]
          )
          return { key, value }
        } catch (err) {
          console.error("Error INSERTING value ", key, value)
          throw err
        }
      } else if (result.rows.length === 1) {
        try {
          await client.query(
            "UPDATE deployments SET data = $1::jsonb, lastdeployment = $3::timestamp WHERE identifier = $2::text",
            [value, key, new Date()]
          )
          return { key, value }
        } catch (err) {
          console.error("Error UPDATING value of ", key, value)
          throw err
        }
      } else {
        throw new Error(`Too many rows with identifer ${key} : ${result.rows.length}`)
      }
    },
    async get(key) {
      const result = await client.query("SELECT identifier, data FROM deployments WHERE identifier=$1::text", [key])
      if (result.rows.length === 0) {
        return { key: key, value: undefined }
      } else if (result.rows.length === 1) {
        return { key: key, value: result.rows[0].data }
      } else {
        throw new Error(`Too many rows with identifer ${key} : ${result.rows.length}`)
      }
    },
  }
}
