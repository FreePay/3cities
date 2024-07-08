//  eslint-disable-next-line no-restricted-imports -- here is our single allowed use of importing from wagmi/chains, used to construct 3cities chains which are then exported to the rest of 3cities
import { arbitrum, arbitrumNova, arbitrumSepolia, base, baseSepolia, blast, blastSepolia, immutableZkEvm, optimism, optimismSepolia, polygon, polygonAmoy, polygonZkEvm, polygonZkEvmCardona, scroll, scrollSepolia, sepolia, linea as wagmiLinea, lineaSepolia as wagmiLineaSepolia, mainnet as wagmiMainnet, mode as wagmiMode, taiko as wagmiTaiko, zkSyncSepoliaTestnet as wagmiZkSyncSeplia, zkSync, zora, zoraSepolia, type Chain } from 'wagmi/chains';
import { NonEmptyArray } from './NonEmptyArray';
import { isProduction } from './isProduction';

// ***************************************************************
const isTestShorterListOfChains = false; // WARNING test flag to be manually toggled during develpment to cull the list of supported chains down to a minimal set for testing purposes
// ***************************************************************

const mainnet: Readonly<Chain> = {
  ...wagmiMainnet,
  name: "Ethereum Mainnet", // the wagmi name of "Ethereum" is confusing for users
};

const linea: Readonly<Chain> = {
  ...wagmiLinea,
  name: "Linea", // the wagmi name of "Linea Mainnet" is spammy
};

const lineaSepolia: Readonly<Chain> = {
  ...wagmiLineaSepolia,
  name: "Linea Sepolia", // the wagmi name of "Linea Sepolia Testnet" is spammy
};

const zkSyncSepolia: Readonly<Chain> = {
  ...wagmiZkSyncSeplia,
  name: "zkSync Sepolia", // the wagmi name of "zkSync Sepolia Testnet" is spammy
};

const taiko: Readonly<Chain> = {
  ...wagmiTaiko,
  name: "Taiko", // the wagmi name of "Taiko Mainnet" is spammy
};

const mode: Readonly<Chain> = {
  ...wagmiMode,
  name: "Mode", // the wagmi name of "Mode Mainnet" is spammy
};

const fluentTestnet: Readonly<Chain> = Object.freeze<Chain>({
  id: 20993,
  name: 'Fluent Developer Preview',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://rpc.dev.thefluent.xyz/'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url: 'https://blockscout.dev.thefluent.xyz/',
    },
  },
  // TODO multicall3
  testnet: true,
});

export { arbitrum, arbitrumNova, arbitrumSepolia, base, baseSepolia, blast, blastSepolia, fluentTestnet, immutableZkEvm, linea, lineaSepolia, mainnet, mode, optimism, optimismSepolia, polygon, polygonAmoy, polygonZkEvm, polygonZkEvmCardona, scroll, scrollSepolia, sepolia, taiko, zkSync, zkSyncSepolia, zora, zoraSepolia, type Chain };

export const chainsSupportedBy3cities: NonEmptyArray<Chain> = (() => {
  const cs = (isProduction ? [
    // ********* BEGIN PRODUCTION networks *********
    mainnet,
    optimism,
    arbitrum,
    arbitrumNova,
    base,
    zkSync,
    scroll,
    linea,
    zora,
    taiko,
    immutableZkEvm,
    polygonZkEvm,
    blast,
    mode,
    polygon,
    // ********* END PRODUCTION networks *********
  ] : [
    // ********* BEGIN TEST networks *********
    sepolia,  // TODO sepolia
    optimismSepolia,
    arbitrumSepolia,
    baseSepolia,
    zkSyncSepolia,
    scrollSepolia,
    lineaSepolia,
    zoraSepolia,
    // TODO taikoSepolia
    // TODO immutable zkEVM testnet -- https://docs.immutable.com/docs/zkEVM/architecture/chain-config
    polygonZkEvmCardona, // Cardona settles on Sepolia
    blastSepolia,
    // TODO modeSepolia
    fluentTestnet,
    polygonAmoy, // polygon PoS testnet alt L1
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
(() => {
  const cs = chainsSupportedBy3cities.filter(c => ((c.testnet === undefined || c.testnet === false) && !isProduction) || (c.testnet && isProduction));
  if (cs.length > 0) {
    throw new Error(`testnet flag is not set correctly chains: ${cs.map(c => `${c.id}=${c.name}`).join(', ')}`);
  }
})();
