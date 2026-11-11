import { Pool } from 'pg';
import { ENV } from '../config/env';

export let pool: Pool | null = null;
let isPostgresAvailable = false;

export function getPgPool(): Pool | null {
  if (pool) return pool;

  try {
    pool = new Pool({
      connectionString: ENV.DATABASE_URL,
      ssl: ENV.PGSSL ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });

    pool.on('error', (err) => {
      console.warn('⚠️ PostgreSQL pool idle client error:', err.message);
    });

    return pool;
  } catch (err: any) {
    console.warn('⚠️ PostgreSQL pool initialization notice:', err.message);
    return null;
  }
}

export async function testPostgresConnection(): Promise<boolean> {
  const p = getPgPool();
  if (!p) return false;

  try {
    const client = await p.connect();
    const res = await client.query('SELECT NOW()');
    client.release();
    isPostgresAvailable = !!res.rows[0];
    return isPostgresAvailable;
  } catch (err: any) {
    isPostgresAvailable = false;
    return false;
  }
}

export function isPgConnected(): boolean {
  return isPostgresAvailable;
}
