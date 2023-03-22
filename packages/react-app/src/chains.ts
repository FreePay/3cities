import { arbitrum, arbitrumGoerli, baseGoerli, goerli, mainnet, optimism, optimismGoerli, scrollTestnet, zkSyncTestnet } from '@wagmi/core/chains';
import { Chain } from 'wagmi';
import { isProduction } from './isProduction';
import { NonEmptyArray } from './NonEmptyArray';

// ***************************************************************
const isTestShorterListOfChains = false; // WARNING test flag to be manually toggled during develpment to cull the list of supported chains down to a minimal set for testing purposes
// ***************************************************************

export const arbitrumNova: Readonly<Chain> = Object.freeze<Chain>({
  id: 42170,
  name: "Arbitrum Nova",
  network: "arbitrumNova",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://nova.arbitrum.io/rpc"],
    },
    public: {
      http: ["https://nova.arbitrum.io/rpc"],
    },
  },
  blockExplorers: {
    etherscan: {
      name: "Arbiscan",
      url: "https://nova.arbiscan.io",
    },
    default: {
      name: "Arbiscan",
      url: "https://nova.arbiscan.io",
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 1746963,
    },
  },
});

export const chainsSupportedBy3cities: NonEmptyArray<Chain> = (() => {
  const cs = (isProduction ? [
    // ********* BEGIN PRODUCTION networks *********
    mainnet,
    optimism,
    arbitrum,
    arbitrumNova,
    // ********* END PRODUCTION networks *********
  ] : [
    // ********* BEGIN TEST networks *********
    goerli,
    optimismGoerli,
    arbitrumGoerli,
    zkSyncTestnet,
    baseGoerli,
    scrollTestnet,
    // ********* END TEST networks *********
    ].filter((c: Chain) => !isTestShorterListOfChains || c.id === scrollTestnet.id)
  );
  const c0 = cs[0];
  if (c0 === undefined) throw new Error(`chainsSupportedBy3cities: set of supported chains is empty`);
  else return [c0, ...cs.slice(1)];
})();

// allChainIds is the set of chainIds we support, ie. the set of chainIds loaded into our wagmi config
export const allSupportedChainIds: NonEmptyArray<number> = (() => {
  const ids: NonEmptyArray<number> = [chainsSupportedBy3cities[0].id, ...chainsSupportedBy3cities.slice(1).map(c => c.id)];
  if (ids.length !== new Set(ids).size) throw new Error(`allChainIds: chain ids were not unique: ${JSON.stringify(ids)}`);
  return ids;
})();

// getChainName returns the chain name for the passed supported
// chainId, or a message indicating the chain is unknown if the passed
// chainId is for an unsupported chain.
export function getSupportedChainName(chainId: number): string {
  const n = chainsSupportedBy3cities.find(n => n.id === chainId); // O(chains) and in the distance future may want to implement a lookup table of chainId -> chainName that's built statically upon module initialization
  return n === undefined ? `unknown chain ${chainId}` : n.name;
}
