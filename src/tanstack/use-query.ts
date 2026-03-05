// Portions of this file are derived from the SpacetimeDB TypeScript SDK
// (`useTable` hook in packages/sdk/src/react/useTable.tsx).
// Copyright (c) 2023 Clockwork Laboratories, Inc.
// Licensed under the Business Source License 1.1
// https://github.com/clockworklabs/SpacetimeDB
//
// Modifications: replaced useSyncExternalStore with TanStack Query's useQuery
// so consumers can use optimistic updates, cancelQueries, and setQueryData.

import {
  useQuery as useBaseQuery,
  useQueryClient,
  type UseQueryOptions,
  type UseQueryResult as UseBaseQueryResult,
} from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useSpacetimeDB } from 'spacetimedb/react'
import type { RowType, UntypedTableDef, Prettify } from '../types'
import {
  type Query,
  toSql,
  type BooleanExpr,
  evaluateBooleanExpr,
  getQueryAccessorName,
  getQueryWhereClause,
} from 'spacetimedb'

export type TableQueryKey = readonly ['spacetimedb', 'table', string]

export type UseTableQueryResult<TableDef extends UntypedTableDef> =
  UseBaseQueryResult<readonly Prettify<RowType<TableDef>>[], Error> & {
    queryKey: TableQueryKey
    /** True once the initial SpacetimeDB subscription snapshot has been applied. */
    isReady: boolean
  }

type TableQueryOptions<TableDef extends UntypedTableDef> = Omit<
  UseQueryOptions<
    readonly Prettify<RowType<TableDef>>[],
    Error,
    readonly Prettify<RowType<TableDef>>[],
    TableQueryKey
  >,
  'queryKey' | 'queryFn'
>

function classifyMembership(
  whereExpr: BooleanExpr<any> | undefined,
  oldRow: Record<string, any>,
  newRow: Record<string, any>
): 'enter' | 'leave' | 'stayIn' | 'stayOut' {
  if (!whereExpr) return 'stayIn'
  const oldIn = evaluateBooleanExpr(whereExpr, oldRow)
  const newIn = evaluateBooleanExpr(whereExpr, newRow)
  if (oldIn && !newIn) return 'leave'
  if (!oldIn && newIn) return 'enter'
  if (oldIn && newIn) return 'stayIn'
  return 'stayOut'
}

/**
 * Subscribe to a SpacetimeDB table and expose the rows through TanStack Query,
 * so you can use optimistic updates, `cancelQueries`, `setQueryData`, etc.
 *
 * The `queryFn` performs an initial snapshot read from the in-memory SpacetimeDB
 * store. After that, SpacetimeDB event listeners call `queryClient.setQueryData`
 * whenever rows change, keeping the TanStack Query cache live.
 *
 * @example
 * ```tsx
 * const { data: players = [], isReady } = useQuery(tables.player)
 *
 * const { mutate: addPlayer } = useMutation(reducer.addPlayer, {
 *   onMutate: async ({ name }) => {
 *     await queryClient.cancelQueries({ queryKey })
 *     const previous = queryClient.getQueryData(queryKey)
 *     queryClient.setQueryData(queryKey, (prev = []) => [...prev, { name }])
 *     return { previous }
 *   },
 *   onError: (_err, _args, ctx) => queryClient.setQueryData(queryKey, ctx?.previous),
 *   onSettled: () => queryClient.invalidateQueries({ queryKey }),
 * })
 * ```
 */
export function useQuery<TableDef extends UntypedTableDef>(
  query: Query<TableDef>,
  options?: TableQueryOptions<TableDef>
): UseTableQueryResult<TableDef> {
  type Row = Prettify<RowType<TableDef>>

  const accessorName = getQueryAccessorName(query)
  const whereExpr = getQueryWhereClause(query)
  const querySql = toSql(query)
  const queryKey: TableQueryKey = ['spacetimedb', 'table', querySql]

  const queryClient = useQueryClient()
  const connectionState = useSpacetimeDB()
  const [isReady, setIsReady] = useState(false)

  const whereExprRef = useRef(whereExpr)
  useEffect(() => {
    whereExprRef.current = whereExpr
  })

  const readRows = (): readonly Row[] => {
    const connection = connectionState.getConnection()
    if (!connection) return []
    const allRows = Array.from(connection.db[accessorName].iter()) as Row[]
    return whereExprRef.current
      ? allRows.filter((row) =>
          evaluateBooleanExpr(whereExprRef.current!, row as Record<string, any>)
        )
      : allRows
  }

  useEffect(() => {
    const connection = connectionState.getConnection()
    if (!connectionState.isActive || !connection) return

    const cancel = connection
      .subscriptionBuilder()
      .onApplied(() => {
        queryClient.setQueryData<readonly Row[]>(queryKey, readRows())
        setIsReady(true)
      })
      .subscribe(querySql)

    return () => {
      cancel.unsubscribe()
      setIsReady(false)
    }
  }, [querySql, connectionState.isActive, connectionState])

  useEffect(() => {
    const connection = connectionState.getConnection()
    if (!connection) return

    const table = connection.db[accessorName]

    const onInsert = (_ctx: any, row: any) => {
      if (
        whereExprRef.current &&
        !evaluateBooleanExpr(whereExprRef.current, row)
      )
        return
      queryClient.setQueryData<readonly Row[]>(queryKey, readRows())
    }

    const onDelete = (_ctx: any, row: any) => {
      if (
        whereExprRef.current &&
        !evaluateBooleanExpr(whereExprRef.current, row)
      )
        return
      queryClient.setQueryData<readonly Row[]>(queryKey, readRows())
    }

    const onUpdate = (_ctx: any, oldRow: any, newRow: any) => {
      if (
        classifyMembership(whereExprRef.current, oldRow, newRow) === 'stayOut'
      )
        return
      queryClient.setQueryData<readonly Row[]>(queryKey, readRows())
    }

    table.onInsert(onInsert)
    table.onDelete(onDelete)
    table.onUpdate?.(onUpdate)

    return () => {
      table.removeOnInsert(onInsert)
      table.removeOnDelete(onDelete)
      table.removeOnUpdate?.(onUpdate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState, accessorName, querySql, queryClient])

  // ── TanStack Query ─────────────────────────────────────────────────────────
  const result = useBaseQuery<
    readonly Row[],
    Error,
    readonly Row[],
    TableQueryKey
  >({
    queryKey,
    // Synchronous cold-read fallback. After `onApplied` fires, `setQueryData`
    // keeps the cache warm so this is effectively never called again unless you
    // explicitly call `invalidateQueries`.
    queryFn: () => readRows(),
    staleTime: Infinity, // SpacetimeDB push events own freshness
    refetchOnWindowFocus: false, // not a REST resource — no polling needed
    refetchOnReconnect: false,
    ...options,
  })

  return { ...result, queryKey, isReady }
}
