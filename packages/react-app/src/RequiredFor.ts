// RequiredFor is a typescript utility type to mark a subset of fields
// in T as required. It's similar to the builtin Required except it
// applies to only the specified subset of fields instead of all fields.
export type RequiredFor<T, K extends keyof T> = T & { [P in K]-?: T[P] }

// type Person = {
//   age?: number;
//   name?: string;
// }

// type PersonWithName = RequiredFor<Person, 'name'>;

// export const personWithName: PersonWithName = {
//   // only age remains optional, name is mandatory
//   name: 'hi',
// };
