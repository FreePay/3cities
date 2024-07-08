import { useMemo } from "react";
import { isAddress } from "viem";
import { useEnsAddress as wagmiUseEnsAddress } from 'wagmi';
import { mainnet, sepolia } from "./chains";
import { isProduction } from "./isProduction";
import { useLiveReloadQueryOptions } from "./useLiveReloadQueryOptions";

// useEnsAddress is our higher-level wrapper around wagmi.useEnsAddress.
// useEnsAddress returns the passed ENS name's address or `address:
// undefined` if no address is set or the passed ensName is invalid.
export function useEnsAddress(ensName: undefined): {
  address?: never;
  error?: never;
  isLoading: false;
}
export function useEnsAddress(ensName: string): {
  address: `0x${string}` | undefined;
  error?: never;
  isLoading: false;
} | {
  address?: never;
  error: Error;
  isLoading: false;
} | {
  address?: never;
  error?: never;
  isLoading: true;
}
export function useEnsAddress(ensName: string | undefined): {
  address?: never;
  error?: never;
  isLoading: false;
} | {
  address: `0x${string}` | undefined;
  error?: never;
  isLoading: false;
} | {
  address?: never;
  error: Error;
  isLoading: false;
} | {
  address?: never;
  error?: never;
  isLoading: true;
}
export function useEnsAddress(ensName: string | undefined): {
  address?: never;
  error?: never;
  isLoading: false;
} | {
  address: `0x${string}` | undefined;
  error?: never;
  isLoading: false;
} | {
  address?: never;
  error: Error;
  isLoading: false;
} | {
  address?: never;
  error?: never;
  isLoading: true;
} {
  const queryOpts = useLiveReloadQueryOptions();
  const { data: address, error, isLoading } = wagmiUseEnsAddress({
    chainId: isProduction ? mainnet.id : sepolia.id,
    name: ensName,
    query: {
      ...queryOpts,
      enabled: queryOpts.enabled && Boolean(ensName && ensName.length > 0 && !isAddress(ensName)), // here !isAddress(ensName) ensures we avoid attempting to fetch an address for a passed ensName that we can statically determine is an invalid ens name because it's actually a valid ethereum address (and every valid ethereum address is an invalid ens name)
      notifyOnChangeProps: ['data', 'error', 'isLoading'],
    },
  });

  const result = useMemo<ReturnType<typeof useEnsAddress>>(() => {
    if (ensName === undefined || ensName.length < 1) return {
      isLoading: false,
    }; else if (error) return {
      error,
      isLoading: false,
    }; else if (isLoading) return {
      isLoading: true,
    }; else if (address) return {
      address,
      isLoading: false,
    }; else {
      // console.log(`useEnsAddress returned undefined. Was it because the passed ensName had no address? ${JSON.stringify({ address, ensName, error, isLoading }, (_key, value) => typeof value === 'undefined' ? null : value)}`);
      return {
        address: undefined,
        isLoading: false,
      };
    }
  }, [ensName, address, error, isLoading]);
  return result;
}
