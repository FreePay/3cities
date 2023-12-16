// eslint-disable-next-line no-restricted-imports -- here is our single allowed use of importing from @wagmi/core/chains, used to construct 3cities chains which are then exported for the rest of 3cities
import { arbitrum, arbitrumGoerli, baseGoerli, goerli, optimismGoerli, polygon, polygonMumbai, polygonZkEvmTestnet, scrollTestnet, mainnet as wagmiMainnet, optimism as wagmiOptimism } from '@wagmi/core/chains';
import { Chain } from 'wagmi';
import { NonEmptyArray } from './NonEmptyArray';
import { isProduction } from './isProduction';

// TODO migrate off of goerli to sepolia --> sepolia chains here https://github.com/wevm/viem/tree/main/src/chains/definitions --> ie. add zoraSepolia, lineaSepolia, scrollSepolia, etc, rm goerli, scrollTestnet (?), baseGoerli, etc.

const mainnet = Object.assign({}, wagmiMainnet, {
  name: "Ethereum L1", // rename to "Ethereum L1" as the wagmi name of "Ethereum" is confusing for users
});

const optimism = Object.assign({}, wagmiOptimism, {
  name: "OP Mainnet", // rename to "OP Mainnet" as the wagmi name of "Optimism" is no longer Optimism's preferred name for this chain
});

export { arbitrum, arbitrumGoerli, baseGoerli, goerli, mainnet, optimism, optimismGoerli, polygon, polygonMumbai, polygonZkEvmTestnet, scrollTestnet };

// ***************************************************************
const isTestShorterListOfChains = false; // WARNING test flag to be manually toggled during develpment to cull the list of supported chains down to a minimal set for testing purposes
// ***************************************************************

export const base: Readonly<Chain> = Object.freeze<Chain>({ // TODO replace this with import from viem when we move to viem
  id: 8453,
  network: 'base',
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    // WARNING these alchemy and infura providers, which were copied from the latest version of viem, seem to be incompatible with our pre-1.0 version of wagmi's alchemyProvider/infuraProvider, throwing the error 'Uncaught Error: unsupported network (argument="network", value={"chainId":8453,"name":"base"},' --> TODO when we upgrade to viem, 3cities base definition can be replaced with the viem import, and alchemy/infura should then work normally for base
    // alchemy: {
    //   http: ['https://base-mainnet.g.alchemy.com/v2'],
    //   webSocket: ['wss://base-mainnet.g.alchemy.com/v2'],
    // },
    // infura: {
    //   http: ['https://base-mainnet.infura.io/v3'],
    //   webSocket: ['wss://base-mainnet.infura.io/ws/v3'],
    // },
    default: {
      http: ['https://mainnet.base.org'],
    },
    public: {
      http: ['https://mainnet.base.org'],
    },
  },
  blockExplorers: {
    blockscout: {
      name: 'Basescout',
      url: 'https://base.blockscout.com',
    },
    default: {
      name: 'Basescan',
      url: 'https://basescan.org',
    },
    etherscan: {
      name: 'Basescan',
      url: 'https://basescan.org',
    },
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 5022,
    },
  },
});

export const baseSepolia: Readonly<Chain> = Object.freeze<Chain>({ // TODO replace this with import from viem when we move to viem
  id: 84532,
  network: 'base-sepolia',
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://sepolia.base.org'],
    },
    public: {
      http: ['https://sepolia.base.org'],
    },
  },
  blockExplorers: {
    blockscout: {
      name: 'Blockscout',
      url: 'https://base-sepolia.blockscout.com',
    },
    default: {
      name: 'Blockscout',
      url: 'https://base-sepolia.blockscout.com',
    },
  },
  testnet: true,
});

export const scroll: Readonly<Chain> = Object.freeze<Chain>({ // TODO replace this with import from viem when we move to viem
  id: 534_352,
  name: 'Scroll',
  network: 'scroll',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://rpc.scroll.io'],
      webSocket: ['wss://wss-rpc.scroll.io/ws'],
    },
    public: {
      http: ['https://rpc.scroll.io'],
      webSocket: ['wss://wss-rpc.scroll.io/ws'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Scrollscan',
      url: 'https://scrollscan.com',
    },
    blockscout: {
      name: 'Blockscout',
      url: 'https://blockscout.scroll.io',
    },
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 14,
    },
  },
});

export const linea: Readonly<Chain> = Object.freeze<Chain>({ // TODO replace this with import from viem when we move to viem
  id: 59_144,
  name: 'Linea',
  network: 'linea-mainnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    // infura: {
    //   http: ['https://linea-mainnet.infura.io/v3'],
    //   webSocket: ['wss://linea-mainnet.infura.io/ws/v3'],
    // },
    default: {
      http: ['https://rpc.linea.build'],
      webSocket: ['wss://rpc.linea.build'],
    },
    public: {
      http: ['https://rpc.linea.build'],
      webSocket: ['wss://rpc.linea.build'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Etherscan',
      url: 'https://lineascan.build',
    },
    etherscan: {
      name: 'Etherscan',
      url: 'https://lineascan.build',
    },
    blockscout: {
      name: 'Blockscout',
      url: 'https://explorer.linea.build',
    },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 42,
    },
  },
});

export const zora: Readonly<Chain> = Object.freeze<Chain>({ // TODO replace this with import from viem when we move to viem
  id: 7777777,
  name: 'Zora',
  network: 'zora',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.zora.energy'],
      webSocket: ['wss://rpc.zora.energy'],
    },
    public: {
      http: ['https://rpc.zora.energy'],
      webSocket: ['wss://rpc.zora.energy'],
    },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explorer.zora.energy' },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 5882,
    },
  },
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

export const zkSyncTestnet: Readonly<Chain> = Object.freeze<Chain>({ // here we declare zkSyncTestnet even though wagmi exports zkSyncTestnet because wagmi's zkSyncTestnet is currently out of date with the latest zkSyncTestnet rpc endpoints. --> TODO replace this with zkSyncSepolia, or is this already on sepolia?
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

export const zkSync: Readonly<Chain> = Object.freeze<Chain>({ // here we declare zkSync even though wagmi exports zkSync because wagmi's zkSync is currently out of date with the final zkSync mainnet rpc endpoints --> TODO replace with viem definition
  id: 324,
  name: "zkSync Era",
  network: "zkSync Era",
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

export const polygonZkEvm: Readonly<Chain> = Object.freeze<Chain>({ // wagmi doesn't yet support polygonZkEvm --> TODO replace with viem definition
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

export const lineaTestnet: Readonly<Chain> = Object.freeze<Chain>({ // wagmi does not yet support Consensus lineaTestnet --> TODO replace with lineaSepolia (or is this already on sepolia?)
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
    scroll,
    linea,
    zora,
    base,
    polygonZkEvm,
    polygon,
    // TODO immutable zkEVM when it launches
    // ********* END PRODUCTION networks *********
  ] : [
    // ********* BEGIN TEST networks *********
    goerli,  // TODO sepolia
    optimismGoerli, // TODO sepolia
    arbitrumGoerli, // TODO sepolia
    zkSyncTestnet, // TODO sepolia
    polygonZkEvmTestnet,  // TODO sepolia
    // lineaTestnet, // TODO lineaTestnet's rpc CORS setting currently doesn't allow requests from http://localhost:3000. This produces spammy linea errors in dev. I have disabled lineaTestnet for now until they fix this, even though it should work fine in staging. --> TODO retry this and use lineaSepolia if exists
    scrollTestnet, // TODO scrollSepolia?
    baseGoerli, // TODO rm
    baseSepolia,
    polygonMumbai,
    // TODO immutable zkEVM testnet -- https://docs.immutable.com/docs/zkEVM/architecture/chain-config
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
// TODO conditional compilation of these sanity tests using macros, eg. using REACT_APP_ENABLE_SANITY_TESTS=true
if (chainsSupportedBy3cities.find(c => !(
  (isProduction && c.testnet === undefined)
  || (!isProduction && c.testnet === true)
)) !== undefined) {
  console.error(chainsSupportedBy3cities);
  throw new Error(`testnet flag is not set correctly for all chains`);
}
