
// Optional is a utility type to make one or more object properties optional instead of required.
export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

// Example:
// type Foo = {
//   foo: 5;
//   bar: 7;
// }
// const foo: Foo = { foo: 5, bar: 7 };
// type FooOptionalBar = Optional<Foo, 'bar'>;
// const fooOptionalBar: FooOptionalBar = { foo: 5 }; // works
