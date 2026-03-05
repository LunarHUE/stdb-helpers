import { PersonList } from './PersonList'
import { prefetch } from '@/lib/preftech'
import { tables } from '@shared/module_bindings'
export default async function Home() {
  const [error, initialPeople] = await prefetch(tables.person)

  if (error) {
    return <div>Error: {error.message}</div>
  }

  console.log('initialPeople', initialPeople)

  await new Promise((resolve) => setTimeout(resolve, 1000))

  const [error2, initialPeople2] = await prefetch(tables.person)
  if (error2) {
    return <div>Error: {error2.message}</div>
  }

  console.log('initialPeople2', initialPeople2)

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>SpacetimeDB Next.js App</h1>
      <PersonList initialPeople={initialPeople} />
    </main>
  )
}
