
// PartialFor is a typescript utility type to mark a subset of fields in
// T as optional. It's similar to the builtin Partial except it applies
// to only the specified subset of fields instead of all fields.
export type PartialFor<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// type Person = {
//   age: number;
//   name: string;
// }

// type PersonWithoutName = PartialFor<Person, 'name'>;

// export const personWithoutName: PersonWithoutName = {
//   // only age remains mandatory, name is optional
//   age: 17,
// };
