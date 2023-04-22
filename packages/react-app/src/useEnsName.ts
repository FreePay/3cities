import { useMemo } from "react";
import { goerli, mainnet, useEnsName as wagmiUseEnsName } from 'wagmi';
import { isProduction } from "./isProduction";
import { makeAddress } from "./makeAddress";
import { truncateENSAddress } from "./truncateAddress";

// useEnsName is our higher-level wrapper around wagmi.useEnsName.
// useEnsName returns the passed address's primary ENS name or undefined if
// no primary ENS name is set, and truncates the returned ENS name if the
// passed truncated option is set.
export function useEnsName(address: undefined, opts?: {
  truncated?: boolean;
  maxENSNameLength?: number;
}): undefined;
export function useEnsName(address: string | undefined, opts?: {
  truncated?: boolean;
  maxENSNameLength?: number;
}): string | undefined;
export function useEnsName(address: string | undefined, opts?: {
  truncated?: boolean; // iff true, the returned ENS name will be truncated
  maxENSNameLength?: number; // iff truncated is true, the returned ENS name will be truncated to this length. Default 14
}): string | undefined {
  const args = useMemo(() => {
    return {
      chainId: isProduction ? mainnet.id : goerli.id,
      address: makeAddress(address || '0x01'), // WARNING HACK TODO permanent solution for makeAddress
      enabled: address !== undefined,
    };
  }, [address]);
  const { data: ensName } = wagmiUseEnsName(args);
  if (address !== undefined && typeof ensName === 'string') {
    if (opts?.truncated) return truncateENSAddress(ensName, opts.maxENSNameLength ?? 14);
    else return ensName;
  } else return undefined;
}
