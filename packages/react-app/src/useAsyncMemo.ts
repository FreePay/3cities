import { DependencyList, useEffect, useMemo, useState } from 'react';

// Design goals of useAsyncMemo (which were achieved)
//  1. mimic React.useMemo's API but for async values
//  2. allow clients to specify a default value such that they never have to handle undefined
//  3. allow the client's promise factory to potentially result in no promise to execute, in which case the async value is not updated
//  4. allow the client to force re-running (recaching) of the promise factory, as in some cases, the client may know that there's fresh data to use but this fresh data can't be detected via passed DependencyList
//  5. provide isLoading and isError so the client can detect that the async value is loading, loaded, or errored.
//  5b. crucially, when dependencies change or forceRecache is called, isLoading is set to true during the same render when the new promise is instantiated. This prevents the hook from returning { value=staleValue, isLoading=false }. In other words, isLoading=false if and only if the returned value is fresh/non-stale.

// Copied from https://github.com/awmleer/use-async-memo/blob/master/src/index.ts
export function useAsyncMemo<T>(factory: () => Promise<T> | undefined | null, deps: DependencyList): { value: T | undefined, isLoading: boolean, isError: boolean, forceRecache: () => void }
export function useAsyncMemo<T>(factory: () => Promise<T> | undefined | null, deps: DependencyList, initialValue: T): { value: T, isLoading: boolean, isError: boolean, forceRecache: () => void }
export function useAsyncMemo<T>(factory: () => Promise<T> | undefined | null, deps: DependencyList, initialValue?: T) {
  const [value, setValue] = useState<T | undefined>(initialValue);
  const setForceRerenderNonce = useState(0)[1];
  const [nonce, setNonce] = useState(0);

  type RichPromise = Promise<T> & { // RichPromise allows us to track whether the promise is loading or errored without using React state. Avoidign use of React state is necessary so that we can compute isLoading synchronously in useMemo to satisfy design goal 5b.
    isLoading: boolean,
    isError: boolean,
  }

  const promise: RichPromise | undefined = useMemo(() => { // the trick here is that when dependencies change, promise is calculated synchronously in a single render with useMemo, resulting in isLoading=true in the same render as where the dependencies changed and the new promise was instantiated. One reason this works is because while the `cancel = false` variable in the useEffect below protects against calling setValue after this hook unmounts, RichPromise needs no such unmount protection because the then/catch/finally handlers are only modifying rich promise itself, so if the component is unmounted by the time those handlers execute, there's no error because we're not calling setState on the unmounted component. Ie. if the component is unmounted during promise settlement, RichPromise will modify only its own state upon settlement and then be garbage collected
    const p = factory();
    if (p === undefined || p === null) return undefined;
    else {
      const rp: RichPromise = Object.assign(p, {
        isLoading: true,
        isError: false,
      });
      rp.then((v) => {
        rp.isError = false;
        return v;
      }).catch(() => {
        rp.isError = true;
      }).finally(() => {
        rp.isLoading = false;
      });
      return rp;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps.concat([nonce]));

  useEffect(() => {
    let cancel = false;
    if (promise) promise.then((v) => {
      if (!cancel) setValue(v);
    }).catch(() => { // WARNING here we use setForceRerenderNonce to ensure the component rerenders when the promise settles. React doesn't know when the promise settles; if the promise is successful, then setValue will be called to rerender the component. But if the promise errors, setValue will not be called, and so we use setForceRerenderNonce to rerender in this case
      if (!cancel) setForceRerenderNonce(n => n + 1);
    });
    return () => { cancel = true; };
  }, [setValue, setForceRerenderNonce, promise]);

  const forceRecache = useMemo<() => void>(() => () => setNonce(n => n + 1), [setNonce]);

  const ret = useMemo(() => {
    return {
      value,
      isLoading: promise?.isLoading ?? false,
      isError: promise?.isError ?? false,
      forceRecache,
    };
  }, [value, forceRecache, promise?.isLoading, promise?.isError]);

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
