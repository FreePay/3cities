import { commify } from "./commify";

export type FormatFloatOpts = {
  showAllZeroesAfterDecimal?: boolean; // iff true, a number ending in all zeroes after the decimal point will retain the zeroes (eg. "1.00"), otherwise they are truncated by default (eg. 1.00 -> "1")
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
  const fRoundedAndTrimmed: string = (opts?.showAllZeroesAfterDecimal !== true && fRounded.endsWith(`.${"0".repeat(decimals)}`)) ? fRounded.substring(0, fRounded.length - 1 - decimals) : fRounded; // if all zeroes after decimal, remove the zeroes
  const commified = commify(fRoundedAndTrimmed);
  return commified;
}
