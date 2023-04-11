import { useAccount } from 'wagmi';
import { useAddressOrENS } from '../useAddressOrENS';

type Opts = NonNullable<Parameters<typeof useAddressOrENS>[1]>;

// useConnectedWalletAddressOrENS returns the connected wallet's primary
// ENS name, or else the address itself if no primary ENS name is set, and
// truncates the returned ENS name or address if the passed truncated
// option is set.
export function useConnectedWalletAddressOrENS(opts?: Opts): string | undefined {
    const { address } = useAccount();
    return useAddressOrENS(address, opts);
}
