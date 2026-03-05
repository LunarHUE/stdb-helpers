'use client'

import { useMemo } from 'react'
import { SpacetimeDBProvider } from 'spacetimedb/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { connection } from '@/lib/connection-builder'

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  const memoizedConnectionBuilder = useMemo(() => connection, [])

  return (
    <QueryClientProvider client={queryClient}>
      <SpacetimeDBProvider connectionBuilder={memoizedConnectionBuilder}>
        {children}
      </SpacetimeDBProvider>
    </QueryClientProvider>
  )
}
