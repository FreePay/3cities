import { useMemo } from "react";
import { goerli, mainnet, useEnsAddress as wagmiUseEnsAddress } from 'wagmi';
import { isProduction } from "./isProduction";

// useEnsAddress is our higher-level wrapper around wagmi.useEnsAddress.
// useEnsAddress returns the passed ENS name's primary address or
// undefined if no primary address is set.
export function useEnsAddress(ensName: string | undefined): {
  address: `0x${string}`;
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
} | {
  address?: never;
  error?: never;
  isLoading?: never;
} {
  const args = useMemo(() => {
    return {
      chainId: isProduction ? mainnet.id : goerli.id,
      name: ensName ?? '',
      enabled: Boolean(ensName && ensName.length > 1 && !ensName.startsWith('0x')),
    }
  }, [ensName]);

  const { data: address, error, isLoading } = wagmiUseEnsAddress(args);

  if (isLoading) return {
    isLoading: true,
  }; else if (typeof address === 'string') return {
    address,
    isLoading: false,
  }; else if (error) return {
    error,
    isLoading: false,
  }; else return {};
}
