import { useMutation as useBaseMutation } from '@tanstack/react-query'
import type {
  UseMutationOptions,
  UseMutationResult as UseBaseMutationResult,
} from '@tanstack/react-query'
import type {
  ParamsType,
} from 'spacetimedb'
import type { UntypedReducerDef } from '../types'
import { useSpacetimeDB } from 'spacetimedb/react'
import { useEffect, useRef, useCallback } from 'react'

export interface UseSpacetimeReducerOptions<
  TArgs,
  TContext = unknown,
> extends Omit<
  UseMutationOptions<void, Error, TArgs, TContext>,
  'mutationFn'
> {}

export type MutationKey = readonly ['spacetimedb', string, string]

export type UseMutationResult<
  TArgs,
  TContext = unknown,
> = UseBaseMutationResult<void, Error, TArgs, TContext> & {
  mutationKey: MutationKey
}

type UnwrapParams<P> = P extends [infer U] ? U : never
type ExternalParams<Params> = UnwrapParams<Params>
/**
 * Call a SpacetimeDB reducer as a TanStack mutation.
 * Supports optimistic updates via `onMutate` / `onError` / `onSettled`.
 *
 * @example
 * const { call: addPlayer } = useMutation(
 *   reducer.addPlayer,
 *   {
 *     onMutate: async ({ name }) => {
 *       await queryClient.cancelQueries({ queryKey })
 *       const previous = queryClient.getQueryData(queryKey)
 *       queryClient.setQueryData(queryKey, prev => [...prev, { name }])
 *       return { previous }
 *     },
 *     onError: (_err, _args, ctx) => {
 *       queryClient.setQueryData(queryKey, ctx?.previous)
 *     },
 *     onSettled: () => queryClient.invalidateQueries({ queryKey }),
 *   }
 * )
 *
 * addPlayer({ name: 'Alice' })
 */

export function useMutation<
  ReducerDef extends UntypedReducerDef,
  Params extends ParamsType<ReducerDef>,
  TContext = unknown,
>(
  reducer: ReducerDef,
  options?: UseMutationOptions<void, Error, ExternalParams<Params>, TContext>
): UseMutationResult<ExternalParams<Params>, TContext> {
  const { getConnection, isActive } = useSpacetimeDB()
  const reducerName = reducer.accessorName

  const queueRef = useRef<
    {
      params: Params
      resolve: () => void
      reject: (err: unknown) => void
    }[]
  >([])

  useEffect(() => {
    const conn = getConnection()
    if (!conn) {
      return
    }
    const fn = (conn.reducers as any)[reducerName] as (
      ...p: Params
    ) => Promise<void>
    if (queueRef.current.length) {
      const pending = queueRef.current.splice(0)
      for (const item of pending) {
        fn(...item.params).then(item.resolve, item.reject)
      }
    }
  }, [getConnection, reducerName, isActive])

  const mutate = useCallback(
    (...params: Params) => {
      const conn = getConnection()
      if (!conn) {
        return new Promise<void>((resolve, reject) => {
          queueRef.current.push({ params, resolve, reject })
        })
      }
      const fn = conn.reducers[reducerName] as (
        ...p: Params
      ) => Promise<void>
      return fn(...params)
    },
    [getConnection, reducerName]
  )

  const mutation = useBaseMutation<void, Error, ExternalParams<Params>, TContext>({
    mutationFn: (vars) => {
      const tuple = [vars] as unknown as Params
      return mutate(...tuple)
    },
    ...options,
  });

  return {
    ...mutation,
    mutationKey: [
      'spacetimedb',
      reducer.name,
      reducer.toString(),
    ] as MutationKey,
  }
}
