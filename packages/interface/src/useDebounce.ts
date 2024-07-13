import { useEffect, useState } from 'react'

// useDebounce debounces the passed T, ie. returns the most recent passed
// value after no further values have been received for the passed
// delayMillis milliseconds. The passed flush flag can be set to force the
// debounced value to immediately update to the passed value.
// https://usehooks-ts.com/react-hook/use-debounce
function useDebounce<T>(value: T, delayMillis: number, flush?: boolean): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    if (flush) setDebouncedValue(value);
    const timer = setTimeout(() => setDebouncedValue(value), delayMillis);
    return () => {
      clearTimeout(timer);
    }
  }, [value, delayMillis, flush]);

  return flush === true ? value : debouncedValue;
}

export default useDebounce;
