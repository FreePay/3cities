import { AddressContext } from "./AddressContext";
import { TokenKey } from "./tokens";

// canAfford is a convenience predicate that returns true iff the passed
// address context can afford to transfer the passed full-precision
// amount of the token indicated by the passed token key.
export function canAfford(ac: AddressContext, tk: TokenKey, amount: bigint): boolean {
  const tb = ac.tokenBalances[tk];
  if (tb === undefined) return false;
  else return tb.balance >= amount; // NB here we are able to compare nominal amounts directly without worrying about units because the passed amount is denominated in full-precision units of the same token as the tokenbalance because both are for the passed token key
}
