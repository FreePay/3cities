import { BigNumber } from "@ethersproject/bignumber";
import { TokenKey } from "./tokens";
import { AddressContext } from "./AddressContext";

// canAfford is a convenience predicate that returns true iff the
// passed address context can afford to transfer the passed amount of
// the token indicated by the passed token key.
export function canAfford(ac: AddressContext, tk: TokenKey, amountAsBigNumberHexString: string): boolean {
  const tb = ac.tokenBalances[tk];
  if (tb === undefined) return false;
  else return BigNumber.from(tb.balanceAsBigNumberHexString).gte(BigNumber.from(amountAsBigNumberHexString)); // NB here we are able to compare nominal amounts directly without worrying about units because the passed amount is denominated in the same token as the tokenbalance because both are for the passed token key
}
