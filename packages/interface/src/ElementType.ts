
// ElementType is a typescript utility type to extrac the element type T
// of an array T[].
export type ElementType<T> = T extends (infer U)[] ? U : never;
