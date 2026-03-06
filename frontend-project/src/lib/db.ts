import { Pool, PoolClient } from 'pg';

// 创建连接池实例（全局）
let pool: Pool | null = null;

/**
 * 获取数据库连接池
 * 使用单例模式确保全局只有一个连接池
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '123456',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'bloom_social',
      max: 10, // 最大连接数
      idleTimeoutMillis: 30000, // 30 秒无操作后关闭连接
      connectionTimeoutMillis: 5000, // 连接超时 5 秒
    });

    // 监听错误事件
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  return pool;
}

/**
 * 执行数据库查询
 */
export async function query<T = any>(
  text: string,
  values?: any[]
): Promise<{ rows: T[]; rowCount: number | null }> {
  const pool = getPool();
  try {
    const result = await pool.query(text, values);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount,
    };
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * 开启事务
 */
export async function beginTransaction(): Promise<PoolClient> {
  const client = await getPool().connect();
  await client.query('BEGIN');
  return client;
}

/**
 * 提交事务
 */
export async function commit(client: PoolClient): Promise<void> {
  try {
    await client.query('COMMIT');
  } finally {
    client.release();
  }
}

/**
 * 回滚事务
 */
export async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
}

/**
 * 关闭连接池
 * 用于应用机不时的清理
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// 为 Vercel 等无服务环境优化
if (process.env.NODE_ENV === 'production') {
  // 在生产环境中，Vercel 会自动处理连接清理
  if (typeof global !== 'undefined') {
    (global as any).__db_pool__ = getPool();
  }
}
