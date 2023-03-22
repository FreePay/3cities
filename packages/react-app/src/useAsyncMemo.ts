import { DependencyList, useEffect, useState } from 'react';

// Copied from https://github.com/awmleer/use-async-memo/blob/master/src/index.ts
export function useAsyncMemo<T>(factory: () => Promise<T> | undefined | null, deps: DependencyList): T | undefined
export function useAsyncMemo<T>(factory: () => Promise<T> | undefined | null, deps: DependencyList, initialValue: T): T
export function useAsyncMemo<T>(factory: () => Promise<T> | undefined | null, deps: DependencyList, initialValue?: T) {
  const [value, setValue] = useState<T | undefined>(initialValue);
  useEffect(() => {
    let cancel = false;
    const promise = factory();
    if (promise === undefined || promise === null) return;
    else {
      promise.then((v) => {
        if (!cancel) {
          setValue(v);
        }
      });
      return () => {
        cancel = true;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

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
