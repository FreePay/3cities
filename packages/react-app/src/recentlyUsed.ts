import localForage from "localforage";
import { queuePromise } from "./queuePromise";

// recentlyUsed maintains local caches of recently used items. For
// example, to keep track of a user's recent preferences.

// NB localforage wraps multiple underlying storage drivers, some of which are synchronous (like localStorage) and others which are async. For that reason, localforage's API is async. This means that components using this library can't fetch data synchronously on their initial render. That's poor UX because the initial render is incomplete as well as a subsequent render is required. For example, see use of this lib with useAsyncMemo to track recently used payment receivers --> TODO add synchronous inital data. One possible design: add to this library an in-memory cache that can be used to synchronously provide initial values. For example, a new `getMostRecentlyUsedSync<T>(key: string): T[]` could be used to populate a component's initial state, and then getMostRecentlyUsed could be used for ongoing async updates --> however, the current API is already quite clunky because getMostRecentlyUsed doesn't auto-update when new content is added or removed (ie. added or removed from either any anonymous client or even the simpler case of the client dong the getMostRecentlyUsed) --> a better approach might be to rebuild recentlyUsed into a synchronous hook `useRecentlyUsedItems(key: string): [recentlyUsedItems, addItem, removeItem, recache]` with a RecentlyUsedProvider that could be used in Routes to cache recently used items for a specific keys. This synchronous hook has the opportunity to automatically update its recentlyUsedItems state when addItem or removeItem are called because those addItem/removeItem functions are stateful callbacks that wrap the passed key. This design would still suffer from the returned recentlyUsedItems being updated automatically on addItem/removeItem called by this client, and doesn't auto-update recentlyUsedItems when any anonymous client adds/removes items for the same key. The hook's returned `recache` helps ameliorate this issue by giving the client a way to force recache of the returned `recentlyUsedItems` from the underlying storage. Another option is to add hook opts to auto-recache on a timer, like `opts.autoRecacheTimeMillis?: number`. localForage doesn't support subscriptions to updates for a particular key, so solving this properly with DB-lib-level push-based updates may be intractable.

const recentlyUsedMaxItems = 10;

export async function addToRecentlyUsed<T>(key: string, t: T): Promise<void> {
  return queuePromise(key, async () => {
    const ru: T[] = await getMostRecentlyUsedSkipQueue(key); // WARNING here we must use getMostRecentlyUsedSkipQueue to skip the promise queue, or else we'll deadlock the promise queue as this promise depends on the subsequentedly queued getMostRecentlyUsed promise to settle. Note that skipping the queue here is correct behavior as queuePromise guarantees that any potentially conflicting changes have already settled before this promise runs
    const ru2 = [t, ...ru.filter(x => x !== t)].slice(0, recentlyUsedMaxItems);
    await localForage.setItem(key, ru2);
  });
}

export async function removeFromRecentlyUsed<T>(key: string, t: T): Promise<void> {
  return queuePromise(key, async () => {
    const ru: T[] = await getMostRecentlyUsedSkipQueue(key); // WARNING here we must use getMostRecentlyUsedSkipQueue to skip the promise queue, or else we'll deadlock the promise queue as this promise depends on the subsequentedly queued getMostRecentlyUsed promise to settle. Note that skipping the queue here is correct behavior as queuePromise guarantees that any potentially conflicting changes have already settled before this promise runs
    const ru2 = ru.filter(x => x !== t);
    await localForage.setItem(key, ru2);
  });
}

export async function clearRecentlyUsed(key: string): Promise<void> {
  return queuePromise(key, async () => {
    await localForage.setItem(key, []);
  });
}

export async function getMostRecentlyUsed<T>(key: string): Promise<T[]> {
  return queuePromise(key, async () => {
    return getMostRecentlyUsedSkipQueue(key);
  });
}

async function getMostRecentlyUsedSkipQueue<T>(key: string): Promise<T[]> {
  const ru: T[] | null = await localForage.getItem<T[]>(key);
  if (ru === null) return [];
  else return ru;
}
