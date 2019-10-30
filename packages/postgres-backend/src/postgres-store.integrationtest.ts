import { PostgresStore } from "./index"
import { PgConfig } from "./pg-config"
import testBackend from "@shepherdorg/storage-backend-tester"

testBackend("Postgres", () => {
  const config = PgConfig()
  return PostgresStore(config)
})
