declare module 'pg' {
  // Tipagem mínima para permitir uso do Pool em ambiente Node.js.
  interface QueryResult<T = unknown> {
    rows: T[]
  }

  interface PoolConfig {
    connectionString?: string
    ssl?: boolean | { rejectUnauthorized: boolean }
  }

  class Pool {
    constructor(config?: PoolConfig)
    connect(): Promise<void>
    end(): Promise<void>
    query<T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>>
  }

  export { Pool, PoolConfig, QueryResult }
}
