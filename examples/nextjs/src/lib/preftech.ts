import { createPrefetch } from '@lunarhue/stdb-helpers/react/prefetch'
import { connection } from './connection-builder'
export const prefetch = createPrefetch(connection.build())
