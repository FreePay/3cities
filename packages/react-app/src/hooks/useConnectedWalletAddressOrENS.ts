import { useEthers, useLookupAddress } from "@usedapp/core";

// useConnectedWalletAddressOrENS returns the currently connected wallet address's
// primary ENS name, or else the address itself if no primary ENS name
// is set, or else undefined if no address is connected.
export default function useConnectedWalletAddressOrENS(): string | undefined {
    const { account } = useEthers();
    const ens = useLookupAddress(account);
    if (typeof account !== 'string') return undefined;
    if (typeof ens === 'string') return ens;
    return account;
}
