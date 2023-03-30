import { useMemo } from "react";
import { goerli, mainnet, useAccount, useEnsName } from 'wagmi';
import { isProduction } from "../isProduction";

// useConnectedWalletAddressOrENS returns the currently connected
// wallet address's primary ENS name, or else the address itself if no
// primary ENS name is set, or else undefined if no wallet is
// connected.
export default function useConnectedWalletAddressOrENS(): string | undefined {
    const { address } = useAccount();
    const args = useMemo(() => {
        if (address !== undefined) return {
            chainId: isProduction ? mainnet.id : goerli.id,
            address,
        };
        else return {
            enabled: false,
        };
    }, [address]);
    const { data: ensName } = useEnsName(args);
    if (ensName !== undefined && ensName !== null) return ensName;
    else if (address !== undefined) return address;
    else return undefined;
}
