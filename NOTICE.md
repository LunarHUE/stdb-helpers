# Notices

## SpacetimeDB TypeScript SDK

Portions of this package are derived from the
[SpacetimeDB TypeScript SDK](https://github.com/clockworklabs/SpacetimeDB).

**Copyright (c) 2023 Clockwork Laboratories, Inc.**
Licensed under the [Business Source License 1.1](https://mariadb.com/bsl11/).
Change Date: 2031-02-27. After that date, the code converts to AGPLv3.

### Affected files

| File | Original source | Nature of derivation |
|---|---|---|
| `src/tanstack/use-query.ts` | `sdk/src/react/useTable.tsx` | Core subscription logic, event listener wiring, and `classifyMembership` adapted; `useSyncExternalStore` replaced with TanStack Query |
| `src/tanstack/use-mutation.ts` | `sdk/src/react/useReducer.tsx` | Queue-before-connect logic preserved; return value wrapped in TanStack Query's `useMutation` |
| `src/types.ts` | `sdk/src/lib/table.ts`, `sdk/src/lib/type_util.ts`, `sdk/src/sdk/reducers.ts` | Internal types not exported by the package, reproduced to enable TypeScript inference |

The remainder of this package is original work licensed under MIT.
