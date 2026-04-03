# Roleplaying-event-and-connection-system

MVP client implementation includes:

- loading skeletons for threads list, thread detail, and timeline board
- optimistic navigation transition state between primary routes
- centralized fetch wrapper with retry + shared network error handling
- toast notification helpers for failed calls, successful refreshes, and role switches
- client-side performance marks for initial page load and route transitions (logged in MVP mode)

## Added source files

- `src/App.tsx`
- `src/lib/fetchClient.ts`
- `src/lib/navigation.ts`
- `src/lib/performance.ts`
- `src/lib/toast.ts`
- `src/features/threads/ThreadsListPage.tsx`
- `src/features/threads/ThreadDetailPage.tsx`
- `src/features/timeline/TimelineBoardPage.tsx`
