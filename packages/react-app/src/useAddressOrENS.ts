import { useMemo } from "react";
import { goerli, mainnet, useEnsName } from 'wagmi';
import { isProduction } from "./isProduction";
import { makeAddress } from "./makeAddress";
import { truncateENSAddress, truncateEthAddress } from "./truncateAddress";

// useAddressOrENS returns the passed address's primary ENS name, or else
// the address itself if no primary ENS name is set, and truncates the
// returned ENS name or address if the passed truncated option is set.
export function useAddressOrENS(address: string, opts?: {
  truncated?: true;
  maxENSNameLength?: number;
}): string;
export function useAddressOrENS(address: undefined, opts?: {
  truncated?: true;
  maxENSNameLength?: number;
}): undefined;
export function useAddressOrENS(address: string | undefined, opts?: {
  truncated?: true;
  maxENSNameLength?: number;
}): string | undefined;
export function useAddressOrENS(address: string | undefined, opts?: {
  truncated?: true; // iff set, the returned ENS name or address will be truncated
  maxENSNameLength?: number; // iff truncated is set, the returned ENS name will be truncated to this length. Defaults to 14, which is how long a truncated address is.
}): string | undefined {
  const args = useMemo(() => {
    return {
      chainId: isProduction ? mainnet.id : goerli.id,
      address: makeAddress(address || '0x01'), // WARNING HACK TODO permanent solution for makeAddress
      enabled: address !== undefined,
    };
  }, [address]);
  const { data: ensName } = useEnsName(args);
  if (address === undefined) return undefined;
  else if (typeof ensName === 'string') {
    if (opts?.truncated) return truncateENSAddress(ensName, opts.maxENSNameLength ?? 14);
    return ensName;
  } else {
    if (opts?.truncated) return truncateEthAddress(address);
    return address;
  }
}
