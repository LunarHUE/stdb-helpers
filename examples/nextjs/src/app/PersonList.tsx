'use client'

import { useState } from 'react'
import { tables, reducers } from '@shared/module_bindings'
import type { Person } from '@shared/module_bindings/types'
import { useQuery } from '@lunarhue/stdb-helpers/tanstack/use-query'
import { useMutation } from '@lunarhue/stdb-helpers/tanstack/use-mutation'
import { useQueryClient } from '@tanstack/react-query'

interface PersonListProps {
  initialPeople: Person[]
}

export function PersonList({ initialPeople }: PersonListProps) {
  const [name, setName] = useState('')

  const queryClient = useQueryClient()
  const {
    data: people,
    isLoading,
    error,
    queryKey,
  } = useQuery(tables.person, {
    initialData: initialPeople,
  })

  const addReducer = useMutation(reducers.add, {
    onMutate: async (data) => {
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (prev: Person[]) => [...prev, data])
      return { previous }
    },
    onError: (_err, _args, ctx) => {
      queryClient.setQueryData(queryKey, ctx?.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  if (error) return <div>Error: {error.message}</div>
  if (isLoading) return <div>Loading...</div>
  if (!people) return <div>Something went wrong</div>

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>Status: </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return

          addReducer.mutate({ name: name })
          setName('')
        }}
        style={{ marginBottom: '2rem' }}
      >
        <input
          type="text"
          placeholder="Enter name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: '0.5rem', marginRight: '0.5rem' }}
        />
        <button type="submit" style={{ padding: '0.5rem 1rem' }}>
          Add Person
        </button>
      </form>

      <div>
        <h2>People ({people.length})</h2>
        {people.length === 0 ? (
          <p>No people yet. Add someone above!</p>
        ) : (
          <ul>
            {people.map((person, index) => (
              <li key={index}>{person.name}</li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
