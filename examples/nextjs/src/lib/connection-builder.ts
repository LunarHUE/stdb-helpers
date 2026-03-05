import {
  DbConnection,
  type ErrorContext,
} from '@lunarhue/stdb-helpers-db/module_bindings'
import type { Identity } from 'spacetimedb'

const HOST =
  process.env.NEXT_PUBLIC_SPACETIMEDB_HOST ?? 'wss://maincloud.spacetimedb.com'
const DB_NAME = process.env.NEXT_PUBLIC_SPACETIMEDB_DB_NAME ?? 'nextjs-ts'
const TOKEN_KEY = `${HOST}/${DB_NAME}/auth_token`

const onConnect = (_conn: DbConnection, identity: Identity, token: string) => {
  console.log('On Connect, is window defined?', typeof window !== 'undefined')
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token)
  }
  console.log('Connected to SpacetimeDB with identity:', identity.toHexString())
}

const onDisconnect = () => {
  console.log('Disconnected from SpacetimeDB')
}

const onConnectError = (_ctx: ErrorContext, err: Error) => {
  console.log('Error connecting to SpacetimeDB:', err)
}

export const connection = DbConnection.builder()
  .withUri(HOST)
  .withDatabaseName(DB_NAME)
  .withToken(
    typeof window !== 'undefined'
      ? localStorage.getItem(TOKEN_KEY) || undefined
      : undefined
  )
  .onConnect(onConnect)
  .onDisconnect(onDisconnect)
  .onConnectError(onConnectError)
