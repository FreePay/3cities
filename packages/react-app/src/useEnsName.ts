import { isAddress } from "@ethersproject/address";
import { useMemo } from "react";
import { useEnsName as wagmiUseEnsName } from 'wagmi';
import { goerli, mainnet } from "./chains";
import { isProduction } from "./isProduction";
import { truncateEnsName } from "./truncateAddress";
import { useEnsAddress } from "./useEnsAddress";
import { useIsPageVisibleOrRecentlyVisible } from "./useIsPageVisibleOrRecentlyVisible";

type Opts = {
  truncate?: boolean; // iff true, the returned ENS name will be truncated.
  maxENSNameLength?: number; // iff truncated is true, the returned ENS name will be truncated to this length. Default 14.
  unsafeDisableForwardResolutionVerification?: boolean; // iff true, disable automatic verification that the forward resolution of the returned ENS name resolves back to the passed address. WARNING this is unsafe because ENS does not enforce the accuracy of reverse records. To be sure a given primary name (reverse record) for an address is correct, we must perform a forward resolution back to the address (which is what useEnsName does by default unless this flag is set). Ie. "0x123" --> "foo.eth" [insecure reverse resolution to primary name] -> forward resolves back to "0x123" [now foo.eth is known to be the a secure primary name (reverse resolution) of 0x123].
}

// useEnsName is our higher-level wrapper around wagmi.useEnsName.
// useEnsName returns the passed address's verified primary name
// (reverse record) or `ensName: undefined` if no primary name is set,
// primary name was set but verification failed (see
// opts.unsafeDisableForwardResolutionVerification), or the passed
// address is invalid.
export function useEnsName(address: undefined, opts?: Opts): {
  ensName?: never;
  error?: never;
  isLoading: false;
}
export function useEnsName(address: `0x${string}`, opts?: Opts): {
  ensName: string | undefined;
  error?: never;
  isLoading: false;
} | {
  ensName?: never;
  error: Error;
  isLoading: false;
} | {
  ensName?: never;
  error?: never;
  isLoading: true;
}
export function useEnsName(address: `0x${string}` | undefined, opts?: Opts): {
  ensName?: never;
  error?: never;
  isLoading: false;
} | {
  ensName: string | undefined;
  error?: never;
  isLoading: false;
} | {
  ensName?: never;
  error: Error;
  isLoading: false;
} | {
  ensName?: never;
  error?: never;
  isLoading: true;
}
export function useEnsName(address: `0x${string}` | undefined, opts?: Opts): {
  ensName?: never;
  error?: never;
  isLoading: false;
} | {
  ensName: string | undefined;
  error?: never;
  isLoading: false;
} | {
  ensName?: never;
  error: Error;
  isLoading: false;
} | {
  ensName?: never;
  error?: never;
  isLoading: true;
} {
  const isPageVisibleOrRecentlyVisible = useIsPageVisibleOrRecentlyVisible();
  const isEnabled = isPageVisibleOrRecentlyVisible && Boolean(address && isAddress(address)); // NB wagmi returns the cached result while disabled, so setting isEnabled==false while page is invisible does not cause the result to be undefined. NB isAddress(address) is needed because the address type `0x${string}` includes invalid ethereum addresses but isAddress ensures validity, including EIP-55 address checksum verification
  const args = useMemo(() => {
    return {
      chainId: isProduction ? mainnet.id : goerli.id,
      address: address ?? '0x00', // here the dummy value of '0x00' satisfies wagmiUseEnsName's requirement for address to be defined, but the dummy value will never be used because isEnabled===true implies address is defined
      enabled: isEnabled,
      staleTime: 15_000, // milliseconds until cached result is considered stale and will be refetched if subsequently requested. If a user is temporarily offline, a result fetched while offline will be undefined and that undefined result will persist even after the user goes back online, so we mark it as stale to correctly fetch the actual result when back online.
    };
  }, [address, isEnabled]);

  const { data: ensName, error: wagmiUseEnsNameError, isLoading: wagmiUseEnsNameIsLoading } = wagmiUseEnsName(args);

  const { address: addressFromENSName, error: useEnsAddressError, isLoading: useEnsAddressIsLoading } = useEnsAddress((opts?.unsafeDisableForwardResolutionVerification ? undefined : ensName) ?? undefined);

  const verificationSuccessful = Boolean(ensName && !useEnsAddressIsLoading && addressFromENSName && addressFromENSName.toLowerCase() === address?.toLowerCase()); // true iff forward resolution of the reverse record ENS name was found to have resolved back to the passed address, indicating the ensName for the passed address has been securely verified.

  const result = useMemo<ReturnType<typeof useEnsName>>(() => {
    if (address === undefined || !isAddress(address)) return {
      isLoading: false,
    }; else if (wagmiUseEnsNameError) return {
      error: wagmiUseEnsNameError,
      isLoading: false,
    }; else if (!opts?.unsafeDisableForwardResolutionVerification && useEnsAddressError) return {
      error: new Error(`useEnsName: forward resolution verification error`, { cause: useEnsAddressError }),
      isLoading: false,
    }; else if (typeof ensName === 'string' && ensName.length > 0 && (opts?.unsafeDisableForwardResolutionVerification || verificationSuccessful)) return {
      ensName: opts?.truncate ? truncateEnsName(ensName, opts.maxENSNameLength ?? 14) : ensName,
      isLoading: false,
    }; else if (wagmiUseEnsNameIsLoading || (!opts?.unsafeDisableForwardResolutionVerification && useEnsAddressIsLoading)) return {
      isLoading: true,
    }; else {
      // console.log(`useEnsName returned undefined. Was it because the passed address had no ens name xor verification failed? ${JSON.stringify({ address, ensName, wagmiUseEnsNameError, isLoading: wagmiUseEnsNameIsLoading, verificationSuccessful, addressFromENSName, useEnsAddressError, useEnsAddressIsLoading, opts }, (_key, value) => typeof value === 'undefined' ? null : value)}`);
      return {
        ensName: undefined,
        isLoading: false,
      };
    }
  }, [address, opts, ensName, wagmiUseEnsNameError, wagmiUseEnsNameIsLoading, verificationSuccessful, useEnsAddressError, useEnsAddressIsLoading]);
  return result;
}
