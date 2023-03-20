
// Writable removes readonly modifiers from T. For example, this is useful when temporarily mutating a Readonly type during construction.
export type Writable<T> = { -readonly [P in keyof T]: T[P] };

// DeepWritable is a flavor of Writable in the case where deep mutability is needed.
export type DeepWritable<T> = { -readonly [P in keyof T]: DeepWritable<T[P]> };
