import { FallbackProvider, JsonRpcProvider } from "@ethersproject/providers";
import { Arbitrum, ArbitrumGoerli, Goerli, Optimism, OptimismGoerli } from "@usedapp/core";

// TODO this is a temporary library to switch the user's wallet network, including auto-adding of certain networks using hardcoded network definitions. This whole library can be replaced by wagmi's useNetwork/switchNetwork libs after we swap usedapp for wagmi, and our redundant network definitions here may be deleted

interface AddEthereumChainParameter { // https://docs.metamask.io/guide/rpc-api.html#wallet-addethereumchain
  chainId: string; // A 0x-prefixed hexadecimal string
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string; // 2-6 characters long
    decimals: 18;
  };
  rpcUrls: string[];
  blockExplorerUrls?: string[];
  iconUrls?: string[]; // Currently ignored.
}

// WARNING HACK - this chain definition is redundant with our libs like usedappConfig and getChainName. This definition is only intended to make this short-term lib work, and should be removed when we switch to wagmi.
const addEthereumChainParameterByChainId: { [chainId: number]: AddEthereumChainParameter } = {
  // Here we expect definitions for every network we support
  [Goerli.chainId]: {
    chainId: `0x${Goerli.chainId.toString(16)}`,
    chainName: 'Goerli',
    nativeCurrency: { name: 'Goerli Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://eth-goerli.g.alchemy.com/v2/FlOQbm_9tqyr6vTDiUooBl6MI2MkCdR1'],
    blockExplorerUrls: ['https://goerli.etherscan.io/'],
  },
  [Optimism.chainId]: {
    chainId: `0x${Optimism.chainId.toString(16)}`,
    chainName: 'Optimism',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.optimism.io'],
    blockExplorerUrls: ['https://optimistic.etherscan.io/'],
  },
  [OptimismGoerli.chainId]: {
    chainId: `0x${OptimismGoerli.chainId.toString(16)}`,
    chainName: 'Optimism Goerli',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://goerli.optimism.io'],
    blockExplorerUrls: ['https://goerli-optimism.etherscan.io/'],
  },
  [Arbitrum.chainId]: {
    chainId: `0x${Arbitrum.chainId.toString(16)}`,
    chainName: 'Arbitrum',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://arbiscan.io/'],
  },
  [ArbitrumGoerli.chainId]: {
    chainId: `0x${ArbitrumGoerli.chainId.toString(16)}`,
    chainName: 'Arbitrum Goerli',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://goerli.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://testnet.arbiscan.io/'],
  },
};

// switchNetwork switches the user's wallet to the destination network
// identified by the passed chainId, adding the new network to the
// user's wallet if necessary. The returned Promise resolves if the
// network switch was successful, rejects otherwise.
// TODO remove our switchNetwork in favor of wagmi's useSwitchNetwork
export async function switchNetwork(provider: JsonRpcProvider | FallbackProvider, chainId: number): Promise<void> {
  function isFallbackProvider(p: JsonRpcProvider | FallbackProvider): p is FallbackProvider {
    return 'quorum' in p;
  }
  if (isFallbackProvider(provider)) throw new Error(`switchNetwork: passed provider is FallbackProvider which is unsupported. TODO replace our switchNetwork with wagmi's useSwitchNetwork`);
  try {
    await provider.send('wallet_switchEthereumChain', [{ chainId: `0x${chainId.toString(16)}` }]); // NB the wallet_switchEthereumChain Promise rejects if the user declines the network switch or the destination chainId is unknown to the user's wallet
  } catch (error) {
    const p = addEthereumChainParameterByChainId[chainId];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof error === 'object' && (error as any).code === 4902 && p !== undefined) { // 4902 is the error code for attempting to switch to an unrecognized chainId
      await provider.send('wallet_addEthereumChain', [{
        chainId: p.chainId,
        chainName: p.chainName,
        rpcUrls: p.rpcUrls,
        nativeCurrency: p.nativeCurrency,
        blockExplorerUrls: p.blockExplorerUrls,
      }]); // NB the wallet_switchEthereumChain Promise rejects if the user declines to add the new network
      await provider.send('wallet_switchEthereumChain', [{ chainId: `0x${chainId.toString(16)}` }]); // metamask (only known implementer) automatically switches after a network is added, so we execute another wallet_switchEthereumChain here because metamask's behavior of auto-switching to a newly added network is not part of the spec and so we want to auto-switch to the new network for wallets in compliance with the spec. Note that metamask's behavior when switching to the currently-active network is a no-op, ie. the promise resolves
    } else {
      // error wasn't due to an attempt to switch to an unrecognized network, so we re-throw it
      throw error;
    }
  }
}
