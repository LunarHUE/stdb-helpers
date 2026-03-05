'use client'

import { useMemo } from 'react'
import { SpacetimeDBProvider } from 'spacetimedb/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { connection } from '@/lib/connection-builder'
import type { DbConnectionBuilder, DbConnectionImpl } from 'spacetimedb'

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  const memoizedConnectionBuilder = useMemo(() => connection, [])

  return (
    <QueryClientProvider client={queryClient}>
      {/* @ts-expect-error - DbConnectionBuilder is not assignable to DbConnectionBuilder<DbConnectionImpl<any>>: tbh i dont know why this is an error. Maybe its because how i have my repo setup :shrug: */}
      <SpacetimeDBProvider connectionBuilder={memoizedConnectionBuilder}>
        {children}
      </SpacetimeDBProvider>
    </QueryClientProvider>
  )
}
