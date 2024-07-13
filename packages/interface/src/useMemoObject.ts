import { useMemo } from 'react';

// NB we might be tempted to think that useMemoObject is a direct substitute of tanstack query's notifyOnChangeProps. However, this isn't the case, they are actually mostly unrelated although they interact. It's because notifyOnChangeProps determines when the component rerenders, whereas useMemoObject maintains object reference stability whenever renders happen to occur if dependencies haven't changed. For example, useSimulateContract may be called with notifyOnChangeProps, and that will prevent the component from rerendering due to this hook instance unless those props change, however, if the component rerenders for any other reason, then the object returned by useSimulateContract will still be unconditionally recreated every render.

// TODO doc
export function useMemoObject<O extends object, K extends keyof O>(o: O, keys: K[]): O {
  return useMemo(() => {
    return o;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- here by definition we want to update the memoized object iff any of the passed keys' values have changed
  }, keys.map(key => o[key]));
}

// useMemoObject memoizes the passed object by constructing a new
// (memoized) object having a subset of the passed object's fields,
// where the subset of fields is identified by the passed keys.
export function useMemoObjectOld<O extends object, K extends keyof O>(o: O, keys: K[]): Pick<O, K> {
  return useMemo(() => {
    return { ...o }; // NB here the memoized object includes all fields in o, not just the passed keys. However, this allows us to construct the memoized value in a typesafe way, and there doesn't seem to be much downside to including all fields in the memoized object. The recomputation happens iff a field changes for a passed key.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- here we want to update the memoized object iff any values have changed
  }, keys.map(key => o[key]));
}
