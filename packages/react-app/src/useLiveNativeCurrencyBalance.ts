import { BigNumber } from "@ethersproject/bignumber";
import { useMemo } from "react";
import { useBalance } from 'wagmi';
import { useIsEnabledSmartRefresh } from "./useIsEnabledSmartRefresh";

// useLiveNativeCurrencyBalance is a React hook that returns a
// live-reloaded ETH (or other native chain currency) balance for the
// passed address and chainId.
export function useLiveNativeCurrencyBalance(
  address: `0x${string}`, // address whose native currency balance will be live-reloaded
  chainId: number, // chainId whose native currency balance will be live-reloaded
): BigNumber | undefined {
  const enabled = useIsEnabledSmartRefresh();
  const args = useMemo(() => {
    return {
      enabled, // here, we are periodically toggling enabled to force a useBalance refresh. We explored solutions like `watch: true` and `staleTime/cacheTime`, and none of them worked for us. See 'redesign of live balance fetching' in 3cities design. Crucially, this toggle works because when useBalance is disabled, it continues returning the most recent result and doesn't return undefined, so the client is unaware that useBalance has been disabled.
      address,
      chainId,
      onError(error: Error) {
        console.error('useLiveNativeCurrencyBalance: error fetching balance with wagmi.useBalance, chainId', chainId, 'address', address, 'error', error);
      },
    }
  }, [chainId, address, enabled]);
  const r = useBalance(args);
  const bRaw = r.data === undefined ? undefined : r.data.value;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const b = useMemo(() => bRaw, [bRaw && bRaw._hex]); // ensure memoization of underlying balance as the BigNumber object instance may change when toggling enabled/disabled of useBalance
  return b;
}
