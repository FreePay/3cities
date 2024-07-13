import { useBalance } from 'wagmi';
import { useLiveReloadQueryOptions } from './useLiveReloadQueryOptions';

// useLiveNativeCurrencyBalance returns a live-reloaded ETH (or other
// native chain currency) balance for the passed address and chainId.
export function useLiveNativeCurrencyBalance(
  address: `0x${string}`, // address whose native currency balance will be live reloaded
  chainId: number, // chainId on which the address's native currency balance will be live reloaded
): bigint | undefined {
  const queryOpts = useLiveReloadQueryOptions();
  const { isSuccess, data } = useBalance({
    chainId,
    address,
    query: {
      ...queryOpts,
      notifyOnChangeProps: ['isSuccess', 'data'],
    },
  });
  return isSuccess ? data.value : undefined;
}
