
// hasOwnProperty is a type guard that returns true iff the passed value is
// an object that has the passed property key.
// Example usage: hasOwnProperty(v, 'foo') && /* do something with v.foo */
export function hasOwnProperty<T, K extends PropertyKey>(value: T, propertyKey: K): value is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(value, propertyKey);
}

type TypeofComparator = "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function";

// hasOwnPropertyOfType is a type guard that returns true iff the passed
// value is an object that has the passed property key and the value at
// that key is typeof the passed propertyType.
// Example usage: hasOwnPropertyOfType(v, 'foo', 'string') && /* do something with v.foo: string */
export function hasOwnPropertyOfType<T, K extends PropertyKey, C extends TypeofComparator>(value: T, propertyKey: K, propertyType: C): value is T & Record<K, C> {
  return hasOwnProperty(value, propertyKey) && typeof value[propertyKey] === propertyType;
}
