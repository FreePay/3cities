import { commify } from "./commify";

export type FormatFloatOpts = {
  truncateTrailingZeroes?: boolean; // iff true, any zeroes (after the decimal point AND after the last significant digit that wasn't rounded) will be truncated
}

// formatFloat formats the passed float to make it suitable to display
// to an end-user.
export function formatFloat(
  float: number | string, // float to format as a number or string in base-10 decimal format
  decimals: number, // number of digits after the decimal point to render, the rest of the digits are rounded
  opts?: FormatFloatOpts,
): string {
  // invariant: decimals integer && decimals > -1
  const f: number = typeof float === 'string' ? Number.parseFloat(float) : float;
  const fRounded: string = f.toFixed(decimals); // eg. output is "1.00" or "1234.40"
  const fRoundedAndTrimmed: string = (opts?.truncateTrailingZeroes === true) ? fRounded.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '') : fRounded;
  const commified = commify(fRoundedAndTrimmed);
  return commified;
}
