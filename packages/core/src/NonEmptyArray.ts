
// NonEmptyArray is a TypeScript type for a non-empty array
export type NonEmptyArray<T> = [T, ...T[]];

// isNonEmptyArray is a TypeScript type guard to narrow T[] into
// NonEmptyArray<T>
export function isNonEmptyArray<T>(ts: T[]): ts is NonEmptyArray<T> {
  return ts.length > 0;
}

// ensureNonEmptyArray is a combination TypeScript type guard and
// assertion to ensure the passed T[] is a NonEmptyArray<T> or else
// throw.
export function ensureNonEmptyArray<T>(ts: T[], emptyErrorMsg?: string): NonEmptyArray<T> {
  if (isNonEmptyArray(ts)) {
    return ts;
  } else {
    throw new Error(`ensureNonEmptyArray: ${emptyErrorMsg && 'expected non-empty array, got empty array'}`);
  }
}
