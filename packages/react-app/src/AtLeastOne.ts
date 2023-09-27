
// AtLeastOne is a TypeScript utility type to ensure a Partial<T> is not
// empty. This allows use of the Partials without permitting clients to
// construct empty objects.
export type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];
