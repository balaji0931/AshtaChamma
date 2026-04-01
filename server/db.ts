import pg from 'pg';
import { validateEnv } from './env.js';

const env = validateEnv();

// ---------------------------------------------------------------------------
// Lazy DB Pool — only connects when online features are used
// ---------------------------------------------------------------------------

let pool: pg.Pool | null = null;
let idleTimer: NodeJS.Timeout | null = null;

// How long to keep the pool alive after the last query (2 minutes)
const IDLE_SHUTDOWN_MS = 2 * 60 * 1000;

function getPool(): pg.Pool {
  if (!pool) {
    console.log('🔌 Connecting to PostgreSQL (on-demand)...');
    pool = new pg.Pool({
      connectionString: env.DATABASE_URL,
      ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err.message);
    });
  }

  // Reset idle timer — pool stays alive while queries are happening
  resetIdleTimer();

  return pool;
}

function resetIdleTimer(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    if (pool) {
      console.log('💤 No activity — closing DB pool to save compute hours');
      await pool.end().catch(() => {});
      pool = null;
    }
    idleTimer = null;
  }, IDLE_SHUTDOWN_MS);
}

/** Execute a parameterized query */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params);
}

/** Execute inside a transaction */
export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Check if the DB pool is currently active */
export function isDBActive(): boolean {
  return pool !== null;
}

/** Initialize DB connection — now just verifies connectivity (optional) */
export async function initDB(): Promise<void> {
  // Don't eagerly connect — just log that we're ready
  console.log('✅ Database configured (lazy connect — will connect on first online action)');
}

/** Graceful shutdown */
export async function closeDB(): Promise<void> {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (pool) {
    await pool.end();
    pool = null;
  }
}
