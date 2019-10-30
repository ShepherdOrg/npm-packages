export interface PGConnectionConfig {
  host: string
  user: string
  database: string
  password: string
  port: number
  idleTimeoutMillis: number
  ssl?: boolean
  schema?: string
}

export function PgConfig(): PGConnectionConfig {
  return {
    host: process.env.SHEPHERD_PG_HOST || "localhost",
    user: process.env.SHEPHERD_PG_USER || "postgres",
    database: process.env.SHEPHERD_PG_DATABASE || "postgres",
    password: process.env.SHEPHERD_PG_PASSWORD || "mysecretpassword",
    port: Number(process.env.SHEPHERD_PG_PORT) || 5432,
    idleTimeoutMillis: 30000,
    ssl: Boolean(process.env.PG_SSL),
    schema: process.env.SHEPHERD_PG_SCHEMA || "shepherd",
  }
}
