import { isAddress } from "@ethersproject/address";
import { mightBeAnEnsName } from "./mightBeAnEnsName";

// mightBeAnAddressOrEnsName returns true iff the passed
// maybeAddressOrEns is detected as a valid adddress or possibly an ENS
// name, otherwise false if maybeEnsName is definitely not an address or
// ENS name. mightBeAnAddressOrEnsName allows clients to quickly
// determine if a given string is definitely not an address or ENS name.
export function mightBeAnAddressOrEnsName(maybeAddressOrEns: string | undefined): boolean {
  return maybeAddressOrEns !== undefined && (isAddress(maybeAddressOrEns) || mightBeAnEnsName(maybeAddressOrEns));
}
