import { isProduction, mainnet, sepolia } from "@3cities/core";
import { useMemo } from "react";
import { isAddress } from "viem";
import { useEnsName as wagmiUseEnsName } from 'wagmi';
import { truncateEnsName } from "./truncateAddress";
import { useEnsAddress } from "./useEnsAddress";
import { useLiveReloadQueryOptions } from "./useLiveReloadQueryOptions";

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
  const queryOpts = useLiveReloadQueryOptions();
  const { data: ensName, error: wagmiUseEnsNameError, isLoading: wagmiUseEnsNameIsLoading } = wagmiUseEnsName({
    chainId: isProduction ? mainnet.id : sepolia.id,
    address,
    query: {
      ...queryOpts,
      enabled: queryOpts.enabled && Boolean(address && isAddress(address)), // use isAddress to disable if address is invalid, including EIP-55 address checksum verification
      notifyOnChangeProps: ['data', 'error', 'isLoading'],
    },
  });

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
