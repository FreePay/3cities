import { type TokenKey } from "@3cities/core";
import { type TokenBalance } from "./TokenBalance";

export type AddressContext = Readonly<{
  address: `0x${string}`;
  tokenBalances: { [tk: TokenKey]: TokenBalance }
}>

// emptyAddressContext is a convenience and safety function to
// construct an empty AddressContext.
export function emptyAddressContext(address: `0x${string}`): AddressContext {
  return {
    address,
    tokenBalances: {},
  };
}
