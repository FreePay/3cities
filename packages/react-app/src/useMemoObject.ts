import { useMemo } from 'react';

// TODO doc
export function useMemoObject<O extends object, K extends keyof O>(o: O, keys: K[]): O {
  return useMemo(() => {
    console.log("ry useMemoObject recache", o, keys); // TODO rm
    return o;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- here by definition we want to update the memoized object iff any of the passed keys' values have changed
  }, keys.map(key => o[key]));
}

// useMemoObject memoizes the passed object by constructing a new
// (memoized) object having a subset of the passed object's fields,
// where the subset of fields is identified by the passed keys.
export function useMemoObjectOld<O extends object, K extends keyof O>(o: O, keys: K[]): Pick<O, K> {
  return useMemo(() => {
    console.log("ry useMemoObject recache", o, keys); // TODO rm
    return { ...o }; // NB here the memoized object includes all fields in o, not just the passed keys. However, this allows us to construct the memoized value in a typesafe way, and there doesn't seem to be much downside to including all fields in the memoized object. The recomputation happens iff a field changes for a passed key.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- here we want to update the memoized object iff any values have changed
  }, keys.map(key => o[key]));
}
