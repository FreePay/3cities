
// flatMap is a functional flatMap. We provide it because
// Array.prototype.flatMap is designed to flatten nested arrays and is
// not a true functional flatMap.
export function flatMap<T, U>(ts: T[], f: (t: T) => U | undefined): U[] {
  return ts.reduce((acc: U[], t: T): U[] => {
    const maybeU: U | undefined = f(t);
    if (maybeU !== undefined) acc.push(maybeU);
    return acc;
  }, []);
}
