export function PgConfig() {
  return {
    host: process.env.SHEPHERD_PG_HOST || "localhost",
    user: process.env.SHEPHERD_PG_USER || "postgres",
    database: process.env.SHEPHERD_PG_DATABASE || "postgres",
    password: process.env.SHEPHERD_PG_PASSWORD || "mysecretpassword",
    port: process.env.SHEPHERD_PG_PORT || 5432,
    idleTimeoutMillis: 30000,
    ssl: process.env.PG_SSL || false,
  }
}
