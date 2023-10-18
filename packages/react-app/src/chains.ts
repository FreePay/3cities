import { arbitrum, arbitrumGoerli, baseGoerli, goerli, mainnet, optimism, optimismGoerli, polygon, polygonMumbai, polygonZkEvmTestnet, scrollTestnet } from '@wagmi/core/chains';
import { Chain } from 'wagmi';
import { isProduction } from './isProduction';
import { NonEmptyArray } from './NonEmptyArray';

// ***************************************************************
const isTestShorterListOfChains = false; // WARNING test flag to be manually toggled during develpment to cull the list of supported chains down to a minimal set for testing purposes
// ***************************************************************

export const taikoTestnet: Readonly<Chain> = Object.freeze<Chain>({
  id: 167004, // TODO this testnet was shut down
  name: "Taiko A2",
  network: "taikoA2",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://l2rpc.a2.taiko.xyz/"],
    },
    public: {
      http: ["https://l2rpc.a2.taiko.xyz/"],
    },
  },
  blockExplorers: {
    etherscan: {
      name: "Taiko Explorer",
      url: "https://l2explorer.a2.taiko.xyz/",
    },
    default: {
      name: "Taiko Explorer",
      url: "https://l2explorer.a2.taiko.xyz/",
    },
  },
  testnet: true,
});

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
      url: "https://nova.arbiscan.io/",
    },
    default: {
      name: "Arbiscan",
      url: "https://nova.arbiscan.io/",
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 1746963,
    },
  },
});

export const zkSyncTestnet: Readonly<Chain> = Object.freeze<Chain>({ // here we declare zkSyncTestnet even though wagmi exports zkSyncTestnet because wagmi's zkSyncTestnet is currently out of date with the latest zkSyncTestnet rpc endpoints.
  id: 280,
  name: "zkSync Testnet",
  network: "zkSync Testnet",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://testnet.era.zksync.dev"],
      webSocket: ["wss://testnet.era.zksync.dev/ws"],
    },
    public: {
      http: ["https://testnet.era.zksync.dev"],
      webSocket: ["wss://testnet.era.zksync.dev/ws"],
    },
  },
  blockExplorers: {
    etherscan: {
      name: "zkSync Explorer",
      url: "https://goerli.explorer.zksync.io/",
    },
    default: {
      name: "zkSync Explorer",
      url: "https://goerli.explorer.zksync.io/",
    },
  },
  // TODO add multicall3 to support batched useContractReads -- canonical multicall3 contract deployment doesn't yet exist on zkSyncTestnet 0xcA11bde05977b3631167028862bE2a173976CA11
  testnet: true,
});

export const zkSync: Readonly<Chain> = Object.freeze<Chain>({ // here we declare zkSync even though wagmi exports zkSync because wagmi's zkSync is currently out of date with the final zkSync mainnet rpc endpoints.
  id: 324,
  name: "zkSync",
  network: "zkSync",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://mainnet.era.zksync.io"],
      webSocket: ["wss://mainnet.era.zksync.io/ws"],
    },
    public: {
      http: ["https://mainnet.era.zksync.io"],
      webSocket: ["wss://mainnet.era.zksync.io/ws"],
    },
  },
  blockExplorers: {
    etherscan: {
      name: "zkSync Explorer",
      url: "https://explorer.zksync.io/",
    },
    default: {
      name: "zkSync Explorer",
      url: "https://explorer.zksync.io/",
    },
  },
  // TODO add multicall3 to support batched useContractReads -- canonical multicall3 contract deployment doesn't yet exist on zkSync 0xcA11bde05977b3631167028862bE2a173976CA11
});

export const polygonZkEvm: Readonly<Chain> = Object.freeze<Chain>({ // wagmi doesn't yet support polygonZkEvm
  id: 1101,
  name: "Polygon zkEVM",
  network: "polygon-zkevm",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://zkevm-rpc.com"],
    },
    public: {
      http: ["https://zkevm-rpc.com"],
    },
  },
  blockExplorers: {
    etherscan: {
      name: "Polygon zkEVM Explorer",
      url: "https://zkevm.polygonscan.com/",
    },
    default: {
      name: "Polygon zkEVM Explorer",
      url: "https://zkevm.polygonscan.com/",
    },
  },
  // TODO add multicall3 to support batched useContractReads -- canonical multicall3 contract deployment doesn't yet exist on polygonZkEvm 0xcA11bde05977b3631167028862bE2a173976CA11
});

export const lineaTestnet: Readonly<Chain> = Object.freeze<Chain>({ // wagmi does not yet support Consensus lineaTestnet
  id: 59140,
  name: "Linea Testnet",
  network: "linea-testnet",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.goerli.linea.build"],
    },
    public: {
      http: ["https://rpc.goerli.linea.build"],
    },
  },
  blockExplorers: {
    etherscan: {
      name: "Linea Testnet Explorer",
      url: "https://explorer.goerli.linea.build/",
    },
    default: {
      name: "Linea Testnet Explorer",
      url: "https://explorer.goerli.linea.build/",
    },
  },
  // TODO add multicall3 to support batched useContractReads -- canonical multicall3 contract deployment doesn't yet exist on Linea 0xcA11bde05977b3631167028862bE2a173976CA11
  testnet: true,
});

export const chainsSupportedBy3cities: NonEmptyArray<Chain> = (() => {
  const cs = (isProduction ? [
    // ********* BEGIN PRODUCTION networks *********
    mainnet,
    optimism,
    arbitrum,
    arbitrumNova,
    zkSync,
    polygonZkEvm,
    polygon,
    // ********* END PRODUCTION networks *********
  ] : [
    // ********* BEGIN TEST networks *********
    goerli,
    optimismGoerli,
    arbitrumGoerli,
    zkSyncTestnet,
    polygonZkEvmTestnet,
    baseGoerli,
    // lineaTestnet, // TODO lineaTestnet's rpc CORS setting currently doesn't allow requests from http://localhost:3000. This produces spammy linea errors in dev. I have disabled lineaTestnet for now until they fix this, even though it should work fine in staging.
    scrollTestnet,
    // taikoTestnet,
    polygonMumbai,
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
  const chain = chainsSupportedBy3cities.find(n => n.id === chainId); // O(chains) and in the distance future may want to implement a lookup table of chainId -> chainName that's built statically upon module initialization
  return chain === undefined ? `unknown chain ${chainId}` : chain.name;
}

// getChain returns the Chain for the passed chainId, or undefined if the
// chain isn't found.
export function getChain(chainId: number | undefined): Chain | undefined {
  if (chainId === undefined) return undefined;
  else return chainsSupportedBy3cities.find(n => n.id === chainId); // O(chains) and in the distance future may want to implement a lookup table of chainId -> chainName that's built statically upon module initialization
}

// unsafeGetChainThrowIfNotFound returns the Chain for the passed chainId,
// throwing if the chainId isn't found.
export function unsafeGetChainThrowIfNotFound(chainId: number): Chain {
  const c = getChain(chainId);
  if (c === undefined) throw new Error(`chain ${chainId} not found`);
  return c;
}

// Sanity tests:
// TODO conditional compilation of these sanity tests using macros. Compile them in dev, prod-test (to be released at test.3cities.xyz), and prod-preview (a new environment and released at preview.3cities.xyz. preview is a production environment with the only difference between preview and prod being REACT_APP_ENABLE_SANITY_TESTS=true).
if (chainsSupportedBy3cities.find(c => !(
  (isProduction && c.testnet === undefined)
  || (!isProduction && c.testnet === true)
)) !== undefined) {
  console.error(chainsSupportedBy3cities);
  throw new Error(`testnet flag is not set correctly for all chains`);
}
