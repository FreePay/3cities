
// toUppercase is a helper function to construct the TypeScript builtin
// utility type Uppercase<T>. TypeScript provides Uppercase<T> but not a
// function to build these types at runtime, so we provide it here.
export function toUppercase<T extends string>(s: T): Uppercase<T> {
  return s.toUpperCase() as Uppercase<T>; // here we must cast to Uppercase<T> because toUpperCase() returns a string and not Uppercase. This cast relies on toUpperCase having the same definition as Uppercase, which it does because it's the literal implementation of Uppercase: https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html --> see "Technical details on the intrinsic string manipulation types" --> `case IntrinsicTypeKind.Uppercase: return str.toUpperCase();`
}
