import { erc20Abi } from "viem";
import { useReadContract } from 'wagmi';
import { useLiveReloadQueryOptions } from "./useLiveReloadQueryOptions";

// useLiveTokenBalance returns a live-reloaded token balance for the
// passed token contract address, address, and chainId.
export function useLiveTokenBalance(
  tokenContractAddress: `0x${string}`, // erc20 token contract address for which the balance will be live reloaded
  address: `0x${string}`, // address whose token balance will be live reloaded
  chainId: number, // chainId on which tokenContractAddress contract resides
): bigint | undefined {
  const queryOpts = useLiveReloadQueryOptions();
  const { isSuccess, data } = useReadContract({
    abi: erc20Abi,
    chainId,
    address: tokenContractAddress,
    functionName: 'balanceOf',
    args: [address],
    query: {
      ...queryOpts,
      notifyOnChangeProps: ['isSuccess', 'data', 'fetchStatus'],
    },
  });
  return isSuccess ? data : undefined;
}
