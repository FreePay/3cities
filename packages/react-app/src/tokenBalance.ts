import { formatUnits } from "@ethersproject/units";
import { BigNumber } from "@ethersproject/bignumber";
import { getDecimalsToRenderForTokenTicker, getTokenByTokenKey, TokenKey } from "./tokens";

// TokenBalance is a snapshot of an address's token balance on a
// specific chain. For example, a snapshot of Bob's DAI balance on
// Arbitrum.
export type TokenBalance = Readonly<{
  address: string; // user address for this token balance
  tokenKey: TokenKey; // TokenKey of the NativeCurrency or Token for this token balance
  balanceAsBigNumberHexString: string; // the actual token balance as a BigNumber.toHexString()
  balanceAsOf: number; // time at which this token balance was snapshotted in milliseconds since epoch
}>

// isZero returns true iff the passed TokenBalance has a zero balance.
export function isZero(tb: TokenBalance): boolean {
  const balance = BigNumber.from(tb.balanceAsBigNumberHexString);
  return balance.isZero();
}

// isDust returns true iff the passed TokenBalance should be
// considered dust, ie. an amount so small as to be negligble and
// safely ignored.
export function isDust(tb: TokenBalance): boolean {
  if (isZero(tb)) return true;
  else {
    // here we define "dust" to mean "would be displayed as 0 after our canonical rounding and precision is applied"
    const t = getTokenByTokenKey(tb.tokenKey);
    const bs = formatUnits(tb.balanceAsBigNumberHexString, t.decimals);
    const bf = Number.parseFloat(bs);
    const br = bf.toFixed(getDecimalsToRenderForTokenTicker(t.ticker));
    const bf2 = Number.parseFloat(br);
    return bf2 === 0;
  }
}
