import {
  getQueryAccessorName,
  toSql,
  type DbConnectionBuilder,
  type DbConnectionImpl,
  type Query,
  type TypedTableDef,
} from 'spacetimedb'
import type { Identity } from 'spacetimedb'
import type { Prettify, RowType, UntypedTableDef } from '../types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PrefetchResult<T> =
  | [error: Error, data: null]
  | [error: null, data: T]

export type PrefetchFn = <TableDef extends UntypedTableDef>(
  query: Query<TableDef>
) => Promise<PrefetchResult<Prettify<RowType<TableDef>>[]>>

/** Config used when `createPrefetch` is given a builder class. */
export interface PrefetchBuilderConfig {
  uri: string
  databaseName: string
  token?: string
  /** Called after a successful connection. Return value is ignored. */
  onConnect?: (identity: Identity, token: string) => void
  /** Called when the temporary prefetch connection disconnects. */
  onDisconnect?: () => void
  /** Called if the temporary prefetch connection fails to connect. */
  onConnectError?: (err: Error) => void
  /** How long to wait before giving up. Defaults to 10 000 ms. */
  timeout?: number
}

// ─── Overloads ────────────────────────────────────────────────────────────────

/**
 * Create a `prefetch` function backed by an **existing live connection**.
 * The connection is never disconnected after prefetching.
 */
export function createPrefetch<TConn extends DbConnectionImpl<any>>(
  connection: TConn
): PrefetchFn

/**
 * Create a `prefetch` function that opens a **short-lived connection** per
 * call using the supplied builder class and config. The connection is
 * automatically disconnected once the subscription snapshot arrives (or on
 * error / timeout).
 */
export function createPrefetch<DbConnection extends DbConnectionImpl<any>>(
  Builder: DbConnectionBuilder<DbConnection>,
  config: PrefetchBuilderConfig
): PrefetchFn

export function createPrefetch<DbConnection extends DbConnectionImpl<any>>(
  connectionOrBuilder: DbConnection | DbConnectionBuilder<DbConnection>,
  config?: PrefetchBuilderConfig
): PrefetchFn {
  const isLiveConnection = isConnection(connectionOrBuilder)

  return async function prefetch<TableDef extends UntypedTableDef>(
    query: Query<TableDef>
  ): Promise<PrefetchResult<Prettify<RowType<TableDef>>[]>> {
    const accessorName = getQueryAccessorName(query)
    const sql = toSql(query)

    if (isLiveConnection) {
      return subscribeAndRead(
        connectionOrBuilder as DbConnection,
        accessorName,
        sql
      )
    }

    const {
      uri,
      databaseName,
      token,
      onConnect,
      onDisconnect,
      onConnectError,
      timeout = 10_000,
    } = config!

    return new Promise((resolve) => {
      const fail = (err: unknown) => {
        clearTimeout(timer)
        try {
          ;(conn as any)?.disconnect?.()
        } catch {}
        resolve([normalizeError(err), null])
      }

      const timer = setTimeout(
        () =>
          fail(
            new Error(
              `prefetch("${sql}") timed out after ${timeout}ms — ` +
                `could not connect to "${uri}" (db: "${databaseName}")`
            )
          ),
        timeout
      )

      let conn: DbConnection | null = null

      let builder = (connectionOrBuilder as DbConnectionBuilder<DbConnection>)
        .withUri(uri)
        .withDatabaseName(databaseName)

      if (token) builder = builder.withToken(token)

      builder
        .onConnectError((_ctx, err) => {
          onConnectError?.(normalizeError(err))
          fail(
            new Error(
              `Failed to connect to SpacetimeDB at "${uri}" (db: "${databaseName}") — ` +
                normalizeError(err).message
            )
          )
        })
        .onConnect((connection, identity, receivedToken) => {
          conn = connection
          onConnect?.(identity, receivedToken)

          subscribeAndRead(connection, accessorName, sql, onDisconnect)
            .then(resolve, (err) => fail(err))
            .finally(() => clearTimeout(timer))
        })
        .build()
    })
  }
}

function subscribeAndRead<DbConnection extends DbConnectionImpl<any>>(
  connection: DbConnection,
  accessorName: string,
  sql: string,
  onDisconnect?: () => void
): Promise<PrefetchResult<any[]>> {
  return new Promise((resolve) => {
    connection
      .subscriptionBuilder()
      .onApplied(() => {
        const tableInstance = (connection.db as any)[accessorName]

        if (!tableInstance) {
          const err = new Error(
            `prefetch: table "${accessorName}" not found on conn.db`
          )
          if (onDisconnect) {
            try {
              connection.disconnect?.()
            } catch {}
            onDisconnect()
          }
          return resolve([err, null])
        }

        const rows = Array.from(tableInstance.iter())

        if (onDisconnect) {
          try {
            connection.disconnect?.()
          } catch {}
          onDisconnect()
        }

        resolve([null, rows])
      })
      .onError((ctx) => {
        const err = new Error(
          `Subscription error for query "${sql}" — ${
            normalizeError(ctx.event).message
          }`
        )
        if (onDisconnect) {
          try {
            connection.disconnect?.()
          } catch {}
          onDisconnect()
        }
        resolve([err, null])
      })
      .subscribe(sql)
  })
}

function isConnection(value: unknown): boolean {
  return (
    value !== null && typeof value === 'object' && 'db' in (value as object)
  )
}

const normalizeError = (err: unknown): Error => {
  if (err instanceof Error) return err
  if (typeof ErrorEvent !== 'undefined' && err instanceof ErrorEvent) {
    const parts = [
      err.message && `message: ${err.message}`,
      err.filename && `file: ${err.filename}:${err.lineno}`,
      err.error instanceof Error && err.error.message,
    ].filter(Boolean)
    return new Error(
      parts.length
        ? `WebSocket ErrorEvent — ${parts.join(', ')}`
        : `WebSocket connection failed (ErrorEvent type="${err.type}", no message attached)`
    )
  }
  if (err && typeof err === 'object') {
    const msg = (err as any).message ?? (err as any).reason ?? (err as any).code
    if (msg) return new Error(String(msg))
    const type = (err as any).type
    return new Error(
      type
        ? `Unknown error (type="${type}")`
        : `Unknown error: ${Object.prototype.toString.call(err)}`
    )
  }
  return new Error(String(err))
}
