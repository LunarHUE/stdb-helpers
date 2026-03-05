import { PersonList } from '../components/person-list'
import { prefetch } from '@/lib/preftech'
import { tables } from '@lunarhue/stdb-helpers-db/module_bindings'
export default async function Home() {
  const [error, initialPeople] = await prefetch(tables.person)

  if (error) {
    return <div>Error: {error.message}</div>
  }

  await new Promise((resolve) => setTimeout(resolve, 1000))

  // take notice that when this prefetch occurs we dont see a new onConnect callback since the same connection is being
  // used again.
  await prefetch(tables.person)

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>SpacetimeDB Next.js App</h1>
      <PersonList initialPeople={initialPeople} />
    </main>
  )
}
