// eslint-disable-next-line no-restricted-imports -- here is our single allowed use of importing from @wagmi/core/chains, used to construct 3cities chains which are then exported for the rest of 3cities
import { arbitrum, polygon, mainnet as wagmiMainnet, optimism as wagmiOptimism } from '@wagmi/core/chains';
import { Chain } from 'wagmi';
import { NonEmptyArray } from './NonEmptyArray';
import { isProduction } from './isProduction';
import { alchemyApiKey } from './alchemyApiKey';

// ***************************************************************
const isTestShorterListOfChains = false; // WARNING test flag to be manually toggled during develpment to cull the list of supported chains down to a minimal set for testing purposes
// ***************************************************************

const mainnet: Readonly<Chain> = {
  ...wagmiMainnet,
  name: "Ethereum Mainnet", // rename to "Ethereum Mainnet" as the wagmi name of "Ethereum" is confusing for users
};

const optimism: Readonly<Chain> = {
  ...wagmiOptimism,
  name: "OP Mainnet", // rename to "OP Mainnet" as the wagmi name of "Optimism" is no longer Optimism's preferred name for this chain
};

export { arbitrum, mainnet, optimism, polygon };

export const sepolia: Readonly<Chain> = Object.freeze<Chain>({ // TODO replace with viem definition after migrating to viem
  id: 11_155_111,
  name: 'Sepolia',
  network: 'sepolia',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: [`https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`],
    },
    public: {
      http: ['https://rpc.sepolia.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Etherscan',
      url: 'https://sepolia.etherscan.io',
    },
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 751532,
    },
    ensRegistry: { address: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' },
    ensUniversalResolver: {
      address: '0xc8Af999e38273D658BE1b921b88A9Ddf005769cC',
      blockCreated: 5_317_080,
    },
  },
  testnet: true,
});

export const base: Readonly<Chain> = Object.freeze<Chain>({ // TODO replace with viem definition after migrating to viem
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

export const baseSepolia: Readonly<Chain> = Object.freeze<Chain>({ // TODO replace with viem definition after migrating to viem
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
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 1059647,
    },
  },
  testnet: true,
});

export const scroll: Readonly<Chain> = Object.freeze<Chain>({ // TODO replace with viem definition after migrating to viem
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

export const linea: Readonly<Chain> = Object.freeze<Chain>({ // TODO replace with viem definition after migrating to viem
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

export const zora: Readonly<Chain> = Object.freeze<Chain>({ // TODO replace with viem definition after migrating to viem
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

export const arbitrumNova: Readonly<Chain> = Object.freeze<Chain>({ // TODO replace with viem definition after migrating to viem
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

export const zkSyncSepolia: Readonly<Chain> = Object.freeze<Chain>({ // TODO replace with viem definition after migrating to viem
  id: 300,
  name: "zkSync Sepolia",
  network: "zkSync Sepolia",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://sepolia.era.zksync.dev"],
    },
    public: {
      http: ["https://sepolia.era.zksync.dev"],
    },
  },
  blockExplorers: {
    default: {
      name: 'Etherscan',
      url: 'https://sepolia-era.zksync.network/',
    },
    native: {
      name: 'zkSync Explorer',
      url: 'https://sepolia.explorer.zksync.io/',
    },
  },
  contracts: {
    multicall3: {
      address: '0xF9cda624FBC7e059355ce98a31693d299FACd963',
      blockCreated: 2292,
    },
  },
  testnet: true,
});

// WARNING TODO perhaps we should disable zkSync until we properly support zkSync addresses. Ordinary EOAs don't work on zkSync because their platform produces different addresses https://support.argent.xyz/hc/en-us/articles/4405255165585-Linking-setting-up-your-zkSync-address-on-Layer-2 --> at very least, we should be warning people before sending funds on zkSync --> but haven't I already sent some funds to zkSync? needs investigation --> TODO investigate before open-sourcing
export const zkSync: Readonly<Chain> = Object.freeze<Chain>({ // here we declare zkSync even though wagmi exports zkSync because wagmi's zkSync is currently out of date with the final zkSync mainnet rpc endpoints --> TODO replace with viem definition after migrating to viem
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
    },
    public: {
      http: ["https://mainnet.era.zksync.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "Etherscan",
      url: "https://era.zksync.network/",
    },
    native: {
      name: 'zkSync Explorer',
      url: 'https://explorer.zksync.io/',
    },
  },
  contracts: {
    multicall3: {
      address: '0xF9cda624FBC7e059355ce98a31693d299FACd963',
      blockCreated: 3908235,
    },
  },
});

export const polygonZkEvm: Readonly<Chain> = Object.freeze<Chain>({ // TODO replace with viem definition after migrating to viem
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
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 57746,
    },
  },
});

export const fluentTestnet: Readonly<Chain> = Object.freeze<Chain>({
  id: 1337,
  network: 'Fluent Testnet',
  name: 'Fluent Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://rpc.dev.thefluent.xyz/'],
    },
    public: {
      http: ['https://rpc.dev.thefluent.xyz/'],
    },
  },
  blockExplorers: {
    blockscout: {
      name: 'Blockscout',
      url: 'https://blockscout.dev.thefluent.xyz/',
    },
    default: {
      name: 'Blockscout',
      url: 'https://blockscout.dev.thefluent.xyz/',
    },
  },
  // TODO multicall3
  testnet: true,
});

export const chainsSupportedBy3cities: NonEmptyArray<Chain> = (() => {
  const cs = (isProduction ? [
    // ********* BEGIN PRODUCTION networks *********
    mainnet,
    optimism,
    arbitrum,
    arbitrumNova,
    base,
    zkSync,
    // TODO reenable scroll, // scroll is currently disabled because rpc is throwing CORS errors on localhost and in prod
    linea,
    zora,
    // TODO taiko
    // TODO immutable zkEVM
    polygonZkEvm,
    polygon,
    // ********* END PRODUCTION networks *********
  ] : [
    // ********* BEGIN TEST networks *********
    sepolia,  // TODO sepolia
    // TODO optimismSepolia
    // TODO arbitrumSepolia
    baseSepolia,
    zkSyncSepolia,
    // TODO scrollSepolia
    // TODO lineaSepolia
    // TODO zoraSepolia
    // TODO taikoSepolia
    // TODO immutable zkEVM testnet -- https://docs.immutable.com/docs/zkEVM/architecture/chain-config
    // TODO polygonZkEvmSepolia (ZkEvm Cardona) https://polygon.technology/blog/polygon-pos-and-polygon-zkevm-new-testnets-for-polygon-protocols
    // TODO polygonSepolia (PoS Amoy)
    // fluentTestnet, // TODO update fluentTestnet (sepolia?)
    // ********* END TEST networks *********
  ].filter((c: Chain) => !isTestShorterListOfChains || c.id === baseSepolia.id)
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
