import { BigNumber } from "@ethersproject/bignumber";
import { useMemo } from "react";
import { useBalance } from 'wagmi';
import { makeAddress } from "../makeAddress";
import { useIsEnabledSmartRefresh } from "../useIsEnabledSmartRefresh";

// useLiveTokenBalance is a React hook that returns a live-reloaded token
// balance for the passed token contract address, address, and chainId.
export function useLiveTokenBalance(
  tokenContractAddress: string, // token contract address whose token balance will be live-reloaded
  address: string, // address whose token balance will be live-reloaded
  chainId: number, // chainId on which tokenAddress contract resides
): BigNumber | undefined {
  const enabled = useIsEnabledSmartRefresh();
  const args = useMemo(() => {
    return {
      enabled, // here, we are periodically toggling enabled to force a useBalance refresh. We explored solutions like `watch: true` and `staleTime/cacheTime`, and none of them worked for us. See 'redesign of live balance fetching' in 3cities design. Crucially, this toggle works because when useBalance is disabled, it continues returning the most recent result and doesn't return undefined, so the client is unaware that useBalance has been disabled.
      token: makeAddress(tokenContractAddress),
      address: makeAddress(address),
      chainId,
      onError(error: Error) {
        console.error('useMemoTokenBalance: error fetching balance with wagmi.useBalance, chainId', chainId, 'token', tokenContractAddress, 'address', address, 'error', error);
      },
    };
  }, [chainId, address, tokenContractAddress, enabled]);
  const r = useBalance(args);
  const bRaw = r.data === undefined ? undefined : r.data.value;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const b = useMemo(() => bRaw, [bRaw && bRaw._hex]); // ensure memoization of underlying balance as the BigNumber object instance may change when toggling enabled/disabled of useBalance
  return b;
}
