import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg'
import { env } from '../utils/env'

export const pool = new Pool({
  host: env.DB_HOST,
  port: Number(env.DB_PORT),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
})

pool.on('connect', () => {
  console.log('\x1b[42m\x1b[37mConnected to PostgreSQL\x1b[0m')
})

export function getPool(): Pool {
  return pool
}

export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function query<T extends QueryResultRow = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const result = await pool.query<T>(sql, params)
  return result.rows
}

export async function executeInTransaction<
  T extends QueryResultRow = any
>(
  client: PoolClient,
  sql: string,
  params: any[] = []
): Promise<QueryResult<T>> {
  return client.query<T>(sql, params)
}

