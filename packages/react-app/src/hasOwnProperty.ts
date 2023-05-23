
// hasOwnProperty is a type guard that returns true iff the passed value is
// an object that has the passed property key.
// Example usage: hasOwnProperty(v, 'foo') && /* do something with v.foo */
export function hasOwnProperty<T, K extends PropertyKey>(value: T, propertyKey: K): value is T & Record<K, unknown> {
  return typeof value === "object" && Object.prototype.hasOwnProperty.call(value, propertyKey);
}

type TypeofComparator = "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function";

// hasOwnPropertyOfType is a type guard that returns true iff the passed
// value is an object that has the passed property key and the value at
// that key is typeof the passed propertyType. Note that overloads for
// each TypeofComparator must be manually defined because even if
// hasOwnPropertyOfType(obj, 'key', 'string') returns true, TypeScript
// won't narrow the type of obj.key to string. This is because C here is
// a string value ("string", "number", etc.), not a TypeScript type.
// Example usage: hasOwnPropertyOfType(v, 'foo', 'string') && /* do something with v.foo: string */
export function hasOwnPropertyOfType<T, K extends PropertyKey>(value: T, propertyKey: K, propertyType: "string"): value is T & Record<K, string>;
export function hasOwnPropertyOfType<T, K extends PropertyKey>(value: T, propertyKey: K, propertyType: "number"): value is T & Record<K, number>;
export function hasOwnPropertyOfType<T, K extends PropertyKey>(value: T, propertyKey: K, propertyType: "bigint"): value is T & Record<K, bigint>;
export function hasOwnPropertyOfType<T, K extends PropertyKey>(value: T, propertyKey: K, propertyType: "boolean"): value is T & Record<K, boolean>;
export function hasOwnPropertyOfType<T, K extends PropertyKey>(value: T, propertyKey: K, propertyType: "symbol"): value is T & Record<K, symbol>;
export function hasOwnPropertyOfType<T, K extends PropertyKey>(value: T, propertyKey: K, propertyType: "undefined"): value is T & Record<K, undefined>;
export function hasOwnPropertyOfType<T, K extends PropertyKey>(value: T, propertyKey: K, propertyType: "object"): value is T & Record<K, object>;
// eslint-disable-next-line @typescript-eslint/ban-types
export function hasOwnPropertyOfType<T, K extends PropertyKey>(value: T, propertyKey: K, propertyType: "function"): value is T & Record<K, Function>;
export function hasOwnPropertyOfType<T, K extends PropertyKey, C extends TypeofComparator>(value: T, propertyKey: K, propertyType: C): value is T & Record<K, C> {
  return hasOwnProperty(value, propertyKey) && typeof value[propertyKey] === propertyType;
}
