
// Narrow<A, B, C> is a utility type ensuring that A's property B is
// of type C. Ie. Narrow generates the subtype of A where A[B] has
// been narrowed to C. Btw, this utility type was co-authored by
// ChatGPT Plus.
// Example:
// type Fish = { species: 'goldfish' | 'tuna'; weight: number; };
// type Tuna = Narrow<Fish, 'species', 'tuna'>; --> the set of all Fish where Fish['species'] == 'tuna'
export type Narrow<A, B extends keyof A, C extends A[B]> = A & {
  [K in B]: A[K] extends object
  ? C extends Narrow<A[K], keyof A[K], A[K][keyof A[K]]> ? C : never
  : Extract<A[K], C>;
};

// ************************ Examples below here ************************

// Examples of narrowing to a literal type
// type Foo = { a: number };
// export type FooAt7 = Narrow<Foo, 'a', 7>; // FAIL: here, we aren't able to Narrow `number` to `7` because TypeScript's Extract doesn't support Extract<number, 7> --> and so in this failed example, FooAt7 is computed as { a: never }
// type Foo2 = { a: 5 | 7 };
// export type Foo2At7 = Narrow<Foo2, 'a', 7>; // Foo2At7 works because Extract<5 | 7, 7> = 7

// Examples of recursive use of Narrow:
// type Baz = { a: number | string; };
// type BazContainer = { baz: Baz; };
// export type BazNumber = Narrow<Baz, 'a', number>;
// export type BazNumberContainer = Narrow<BazContainer, 'baz', Narrow<Baz, 'a', number>>;
// export const bnc: BazNumberContainer = { baz: { a: 5 } };
// export const bncBroken: BazNumberContainer = { baz: { a: 'abc' } }; // expected error: nested prop `a` must be a number
// type BaqContainer = { baq: BazContainer; };
// export type BaqNumberContainer = Narrow<BaqContainer, 'baq', Narrow<BazContainer, 'baz', Narrow<Baz, 'a', number>>>;
// export const baq: BaqNumberContainer = { baq: { baz: { a: 5 } } };
// export const baqBroken: BaqNumberContainer = { baq: { baz: { a: 'abc' } } }; // expected error: nested prop `a` must be a number
