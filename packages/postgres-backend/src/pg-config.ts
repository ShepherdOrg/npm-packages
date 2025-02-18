export interface PGConnectionConfig {
  host: string
  user: string
  database: string
  password: string
  port: number
  idleTimeoutMillis?: number
  ssl?: { crt?: string; rejectUnauthorized?: boolean }
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
    ssl: process.env.PG_ROOT_SSL_CRT ? { rejectUnauthorized: false, crt: process.env.PG_ROOT_SSL_CRT } : undefined,
    schema: process.env.SHEPHERD_PG_SCHEMA || "shepherd",
  }
}
