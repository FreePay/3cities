import { type DependencyList, useEffect, useMemo, useState } from 'react';

// Design goals of useAsyncMemo (which were achieved)
//  1. mimic React.useMemo's API but for async values.
//  2. allow clients to specify a default value such that they never have to handle undefined.
//  3. allow the client's promise factory to potentially result in no promise to execute, in which case the async value is not updated and most recent value is retained.
//  4. allow the client to force re-running (recaching) of the promise factory, as in some cases, the client may know that there's fresh data to use but this fresh data can't be detected via passed DependencyList.
//  5. provide isLoading and isError so the client can detect that the async value is loading, loaded, or errored.
//  5b. crucially, when dependencies change or forceRecache is called, isLoading is set to true during the same render. This prevents the hook from returning { value=staleValue, isLoading=false }. In other words, isLoading=false if and only if the returned value is fresh/non-stale.
//  5c. although isLoading is set to true during the same render where dependencies change or forceRecache is called, the client's promise factory is called only on a deferred basis and not during the this same render.

const ClientPromiseFactoryReturnedUndefined = Symbol('ClientPromiseFactoryReturnedUndefined'); // a sentinel value indicating that the client's promise factory returned no promise

const ClientPromiseRejected = Symbol('ClientPromiseRejected'); // a sentinel value indicating that the client's promise rejected

// Forked from https://github.com/awmleer/use-async-memo/blob/master/src/index.ts
export function useAsyncMemo<T>(factory: () => Promise<T> | undefined | null, deps: DependencyList): { value: T | undefined, isLoading: boolean, isError: boolean, forceRecache: () => void }
export function useAsyncMemo<T>(factory: () => Promise<T> | undefined | null, deps: DependencyList, initialValue: T): { value: T, isLoading: boolean, isError: boolean, forceRecache: () => void }
export function useAsyncMemo<T>(factory: () => Promise<T> | undefined | null, deps: DependencyList, initialValue?: T) {
  const [value, setValue] = useState<T | undefined>(initialValue);
  const [nonce, setNonce] = useState(0); // a nonce that when incremented will force rerunning and recaching of the passed promise factory

  type RichPromise = Promise<T | typeof ClientPromiseFactoryReturnedUndefined | typeof ClientPromiseRejected> & { // RichPromise allows us to track whether the client's promise is loading or rejected without using React state. Avoiding use of React state is necessary so that we can compute isLoading synchronously in useMemo to satisfy design goal 5b.
    isLoading: boolean,
    isError: boolean,
  }

  const richPromise: RichPromise = useMemo(() => { // the trick here is that when dependencies change, richPromise is calculated synchronously in a single render with useMemo, resulting in isLoading=true in the same render as where the dependencies changed and the new promise was instantiated. One reason this works is because while the `cancel = false` variable in the useEffect below protects against calling setValue after this hook unmounts, RichPromise needs no such unmount protection because the then/catch/finally handlers are only modifying rich promise itself, so if the component is unmounted by the time those handlers execute, there's no error because we're not calling setState on the unmounted component. Ie. if the component is unmounted during promise settlement, RichPromise will modify only its own state upon settlement and then be garbage collected
    const p: Promise<T | typeof ClientPromiseFactoryReturnedUndefined> = new Promise<void>((resolve) => resolve()) // WARNING the first parameter of the Promise constructor is executed immediately by the Promise during construction (https://stackoverflow.com/questions/42118900/when-is-the-body-of-a-promise-constructor-callback-executed/42118995#42118995) and so, this initial promise with a no-op resolve() is needed to ensure that the client's promise factory is not executed until useAsyncMemo finishes setting up the hooks and state below. If we were to remove this no-op promise, then we'd introduce a concurrency bug where the client's promise executes when this promise `p` is constructed and before useAsyncMemo ends, which breaks useAsyncMemo's promise handlers because if an `await` statement is encountered when executing the client's promise, the JS runtime will suspend execution of this initial useAsyncMemo invocation before the hooks and state below can complete (ie. React renders must be synchronous and never suspend)
      .then<T | typeof ClientPromiseFactoryReturnedUndefined>(async () => {
        const clientPromise = factory();
        if (clientPromise === undefined || clientPromise === null) return ClientPromiseFactoryReturnedUndefined;
        else return await clientPromise;
      });

    let rp: RichPromise | undefined = undefined; // here we close over the `rp` reference so that our promise chain sets state on the final promise returned to the client. This avoids building a forked promise chain with race conditions between the handlers below and the client's handlers (ie. with a forked promise chain, `isLoading = false` may occur after `setValue`)
    rp = Object.assign(p.then<T | typeof ClientPromiseFactoryReturnedUndefined>((v) => {
      // NB this promise chain can't execute synchronously because `p` doesn't settle synchronously (see WARNING above on `p` definition), so we are guaranteed that `rp` has been assigned before executing this promise chain
      if (rp) rp.isError = false; else throw new Error("rp is undefined");
      return v;
    }).catch<typeof ClientPromiseRejected>((e) => {
      if (rp) rp.isError = true; else throw new Error("rp is undefined");
      console.error('useAsyncMemo: client promise rejected', e);
      return ClientPromiseRejected;
    }).finally(() => {
      if (rp) rp.isLoading = false; else throw new Error("rp is undefined");
    }), {
      isLoading: true,
      isError: false,
    });

    return rp;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps.concat([nonce]));

  useEffect(() => {
    let cancel = false;
    richPromise.then((v) => {
      if (!cancel && v !== ClientPromiseFactoryReturnedUndefined && v !== ClientPromiseRejected) setValue(v);
    }).catch((e) => console.error("useAsyncMemo: unexpected RichPromise rejection", e));
    return () => { cancel = true; };
  }, [setValue, richPromise]);

  const forceRecache = useMemo<() => void>(() => () => setNonce(n => n + 1), [setNonce]);

  const ret = useMemo(() => {
    return {
      value,
      isLoading: richPromise.isLoading ?? false,
      isError: richPromise.isError ?? false,
      forceRecache,
    };
  }, [value, forceRecache, richPromise.isLoading, richPromise.isError]);

  return ret;
}

// export const UseAsyncMemoTest: React.FC = () => {
//   const { value, isLoading, isError } = useAsyncMemo(() => new Promise((_resolve, reject) => {
//     setTimeout(() => {
//       reject('hello');
//     }, 3000);
//   }), []);

//   console.log({ value, isLoading, isError });

//   return undefined;
// }

// TODO WARNING useAsyncValuesMemo is unused right now. Before it can be used, it should have its API and internals updated to similarly to useAsyncMemo, eg. to provide isLoading, which is particularly important for clients to detect stale values.

// useAsyncValuesMemo provides a list of values where each of those
// values has been produced by a parallel and independent async
// computation that may fail and result in dropping that particular
// value. useAsyncValuesMemo provides each value eagerly as that
// value's promise resolves, and maintains order of values based on
// the order of the passed promises. See below for usage examples.
export function useAsyncValuesMemo<T>(promisesFactory: () => Promise<T | undefined>[]): T[] | undefined
export function useAsyncValuesMemo<T>(promisesFactory: () => Promise<T | undefined>[], initialValue: T[]): T[]
export function useAsyncValuesMemo<T>(promisesFactory: () => Promise<T | undefined>[], initialValue?: T[]): T[] | undefined {
  const [ts, setTs] = useState<T[] | undefined>(initialValue);
  useEffect(() => {
    let cancel = false;
    const ps: Promise<T | undefined>[] = promisesFactory();
    const tsInProgress: T[] = new Array(ps.length);
    ps.forEach((p: Promise<T | undefined>, i) => {
      p.then((t: T | undefined) => {
        if (t !== undefined) {
          tsInProgress[i] = t;
          if (!cancel) {
            setTs(tsInProgress.filter(o => o !== undefined));
          }
        }
      });
    });
    return () => {
      cancel = true;
    };
  }, [promisesFactory]);
  return ts;
}

// useAsyncValuesMemo examples:
//
// Example 1, filtering a list of values, where the filter function is async and operates on each value independently:
// function useFilteredValues(values: MyValue[]): MyValue[] | undefined {
//   const promisesFactory = useCallback<() => Promise<MyValue | undefined>[]>(() => {
//     const topValues = values.slice(0, 10); // only run the expensive filter operation on the top 10 values; we don't need more than that (for whatever reason)
//     return topValues.map(v => new Promise(async (resolve, reject) => {
//       try {
//         const isValueOk = await expensiveCheck(v);
//         resolve(isValueOk ? v : undefined);
//       } catch (e) {
//         console.error(e);
//         reject(e);
//       }
//     }));
//   }, [values])
//   return useAsyncValuesMemo(promisesFactory);
// }
// 
// Example 2, resolving a list of string addresses to structured address objects by calling an API
// function useResolveAddresses(addresses: string[]): Address[] | undefined {
//   const promisesFactory = useCallback<() => Promise<Address | undefined>[]>(() => {
//     return addresses.map(a => new Promise(async (resolve, reject) => {
//       try {
//         resolve(await expensiveResolveAddress(a));
//       } catch (e) {
//         console.error(e);
//         reject(e);
//       }
//     }));
//   }, [addresses])
//   return useAsyncValuesMemo(promisesFactory);
// }
