
// IntRange<A, B> is a TypeScript utility type for integers between
// [A, B-1] inclusive. Eg. IntRange[1,11] = 1 | 2 | 3 | 4 | 5 | 6 | 7
// | 8 | 9 | 10.
export type IntRange<MinInclusive extends number, MaxExclusive extends number> = Exclude<Enumerate<MaxExclusive>, Enumerate<MinInclusive>>

type Enumerate<N extends number, Acc extends number[] = []> = Acc['length'] extends N
  ? Acc[number]
  : Enumerate<N, [...Acc, Acc['length']]>

// type Test = IntRange<20, 300>
// const works1: Test = 20;
// const works2: Test = 100;
// const works3: Test = 299;
// const fails1: Test = 300;
// const fails2: Test = 20.5;
// const fails3: Test = 19;
// const fails4: Test = 299.01;

// type Test2 = IntRange<1, 2>
// const works4: Test2 = 1;
// const fails5: Test2 = 1.2;
// const fails6: Test2 = 0.9;
// const fails7: Test2 = 0;
// const fails8: Test2 = 2
