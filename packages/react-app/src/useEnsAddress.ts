import { isAddress } from "@ethersproject/address";
import { useMemo } from "react";
import { goerli, mainnet, useEnsAddress as wagmiUseEnsAddress } from 'wagmi';
import { isProduction } from "./isProduction";
import { useIsPageVisibleOrRecentlyVisible } from "./useIsPageVisibleOrRecentlyVisible";

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
  const isPageVisibleOrRecentlyVisible = useIsPageVisibleOrRecentlyVisible();
  const isEnabled = isPageVisibleOrRecentlyVisible && Boolean(ensName && ensName.length > 0 && !isAddress(ensName)); // NB wagmi returns the cached result while disabled, so setting isEnabled==false while page is invisible does not cause the result to be undefined
  const args = useMemo(() => {
    return {
      chainId: isProduction ? mainnet.id : goerli.id,
      name: ensName ?? '',
      enabled: isEnabled,
      staleTime: 15_000, // milliseconds until cached result is considered stale and will be refetched if subsequently requested. If a user is temporarily offline, a result fetched while offline will be undefined and that undefined result will persist even after the user goes back online, so we mark it as stale to correctly fetch the actual result when back online.
    }
  }, [ensName, isEnabled]);

  const { data: address, error, isLoading } = wagmiUseEnsAddress(args);

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
}
