# spacetimedb-helpers

A collection of helpers for building apps with [SpacetimeDB](https://spacetimedb.com) — like [`convex-helpers`](https://github.com/get-convex/convex-helpers) but for SpacetimeDB.

## Installation

```bash
bun add @lunarhue/stdb-helpers spacetimedb @tanstack/react-query
```

> **Note:** This package has a peer dependency on `spacetimedb` ^2.0.3 and `@tanstack/react-query` ^5.

---

## Setup

Wrap your app with both `QueryClientProvider` and SpacetimeDB's `SpacetimeDBProvider`.

```tsx
// providers.tsx
'use client'

import { useMemo } from 'react'
import { SpacetimeDBProvider } from 'spacetimedb/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DbConnection } from './module_bindings'

const queryClient = new QueryClient()

const connectionBuilder = DbConnection.builder()
  .withUri(process.env.NEXT_PUBLIC_SPACETIMEDB_HOST!)
  .withDatabaseName(process.env.NEXT_PUBLIC_SPACETIMEDB_DB_NAME!)

export function Providers({ children }: { children: React.ReactNode }) {
  const builder = useMemo(() => connectionBuilder, [])

  return (
    <QueryClientProvider client={queryClient}>
      <SpacetimeDBProvider connectionBuilder={builder}>
        {children}
      </SpacetimeDBProvider>
    </QueryClientProvider>
  )
}
```

---

## API

### `useQuery(query, options?)`

Subscribe to a SpacetimeDB table and expose the rows through TanStack Query. The initial snapshot is read synchronously from the in-memory SpacetimeDB store, then SpacetimeDB's event listeners (`onInsert`, `onDelete`, `onUpdate`) keep the TanStack Query cache live.

```tsx
import { useQuery } from '@lunarhue/stdb-helpers/tanstack/use-query'
import { tables } from './module_bindings'

function PlayerList() {
  const { data: players = [], isReady, queryKey } = useQuery(tables.player)

  if (!isReady) return <p>Connecting...</p>

  return (
    <ul>
      {players.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  )
}
```

**Returns** everything `useQuery` from TanStack returns, plus:

| Field      | Type                               | Description                                                    |
| ---------- | ---------------------------------- | -------------------------------------------------------------- |
| `queryKey` | `['spacetimedb', 'table', string]` | Use with `queryClient.setQueryData` / `cancelQueries`          |
| `isReady`  | `boolean`                          | `true` once the initial subscription snapshot has been applied |

**Options** — accepts all standard TanStack `UseQueryOptions` except `queryKey` and `queryFn`. Useful options:

| Option        | Description                                                       |
| ------------- | ----------------------------------------------------------------- |
| `initialData` | Seed the cache with server-prefetched data (see `createPrefetch`) |

---

### `useMutation(reducer, options?)`

Call a SpacetimeDB reducer as a TanStack mutation. If the connection isn't established yet, calls are queued and flushed automatically once connected.

```tsx
import { useMutation } from '@lunarhue/stdb-helpers/tanstack/use-mutation'
import { reducers } from './module_bindings'

function AddPlayerForm() {
  const { mutate: addPlayer, isPending } = useMutation(reducers.addPlayer)

  return (
    <button onClick={() => addPlayer({ name: 'Alice' })} disabled={isPending}>
      Add Player
    </button>
  )
}
```

**Returns** everything `useMutation` from TanStack returns, plus:

| Field         | Type                              | Description                 |
| ------------- | --------------------------------- | --------------------------- |
| `mutationKey` | `['spacetimedb', string, string]` | Stable key for this reducer |

**Options** — accepts all standard TanStack `UseMutationOptions` except `mutationFn`.

---

#### Optimistic Updates

`useQuery` and `useMutation` compose directly with TanStack Query's optimistic update pattern:

```tsx
function PersonList() {
  const queryClient = useQueryClient()
  const { data: people = [], queryKey } = useQuery(tables.person)

  const { mutate: addPerson } = useMutation(reducers.add, {
    onMutate: async (newPerson) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (prev: Person[]) => [
        ...prev,
        newPerson,
      ])
      return { previous }
    },
    onError: (_err, _args, ctx) => {
      queryClient.setQueryData(queryKey, ctx?.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  return (
    <>
      <ul>
        {people.map((p, i) => (
          <li key={i}>{p.name}</li>
        ))}
      </ul>
      <button onClick={() => addPerson({ name: 'Alice' })}>Add</button>
    </>
  )
}
```

---

### `createPrefetch(connection | Builder, config?)`

Create a `prefetch` function for fetching table data outside of React — useful for SSR and React Server Components.

Two overloads:

**With an existing live connection** (recommended when you can reuse a connection):

```ts
// lib/prefetch.ts
import { createPrefetch } from '@lunarhue/stdb-helpers/react/prefetch'
import { DbConnection } from './module_bindings'

export const prefetch = createPrefetch(DbConnection.builder().build())
```

**With a builder + config** (creates a short-lived connection per call, disconnects after snapshot):

```ts
import { createPrefetch } from '@lunarhue/stdb-helpers/react/prefetch'
import { DbConnection } from './module_bindings'

export const prefetch = createPrefetch(DbConnection.builder(), {
  uri: 'wss://maincloud.spacetimedb.com',
  databaseName: 'my-db',
  timeout: 10_000, // ms, default
})
```

**Usage in a Server Component:**

```tsx
// app/page.tsx
import { prefetch } from '@/lib/prefetch'
import { tables } from './module_bindings'

export default async function Page() {
  const [error, initialPeople] = await prefetch(tables.person)

  if (error) return <div>Error: {error.message}</div>

  return <PersonList initialPeople={initialPeople} />
}
```

**Client-side hydration** — pass the prefetched data as `initialData` to `useQuery`:

```tsx
'use client'

export function PersonList({ initialPeople }: { initialPeople: Person[] }) {
  const { data: people = [] } = useQuery(tables.person, {
    initialData: initialPeople,
  })

  // ...
}
```

**`prefetch` return type** — a tuple, never throws:

```ts
type PrefetchResult<T> = [error: null, data: T[]] | [error: Error, data: null]
```

**`createPrefetch` config options** (builder overload only):

| Option           | Type                        | Default | Description                                 |
| ---------------- | --------------------------- | ------- | ------------------------------------------- |
| `uri`            | `string`                    | —       | WebSocket URL of your SpacetimeDB host      |
| `databaseName`   | `string`                    | —       | Database name                               |
| `token`          | `string`                    | —       | Optional auth token                         |
| `timeout`        | `number`                    | `10000` | Connection timeout in ms                    |
| `onConnect`      | `(identity, token) => void` | —       | Called on successful connection             |
| `onDisconnect`   | `() => void`                | —       | Called when the ephemeral connection closes |
| `onConnectError` | `(err: Error) => void`      | —       | Called if the connection fails              |

---

## Example

See the full Next.js example in [`examples/nextjs/`](examples/nextjs/) which demonstrates:

- Provider setup with `SpacetimeDBProvider` + `QueryClientProvider`
- Server-side prefetch in a React Server Component
- Client-side real-time subscription with `useQuery`
- Optimistic adds with `useMutation`
- Auth token persistence via `localStorage`

---

### Local Development

```bash
bun install
bun run dev
```

Requires [Bun](https://bun.sh)
