
// NonEmptyArray is a TypeScript type for a non-empty array
export type NonEmptyArray<T> = [T, ...T[]];

export function isNonEmptyArray<T>(ts: T[]): ts is NonEmptyArray<T> {
  return ts.length > 0;
}
