import { arbitrum, arbitrumSepolia, base, baseSepolia, blast, blastSepolia, getChain, linea, lineaSepolia, mainnet, optimism, optimismSepolia, polygon, polygonAmoy, polygonZkEvm, polygonZkEvmCardona, sepolia, zkSync, zkSyncSepolia, zora, zoraSepolia } from './chains';
import { isProduction } from './isProduction';

const alchemyApiKey: string = (() => {
  const s = process.env['REACT_APP_ALCHEMY_API_KEY'];
  if (s === undefined) {
    console.error("REACT_APP_ALCHEMY_API_KEY undefined");
    return 'REACT_APP_ALCHEMY_API_KEY_undefined';
  } else return s;
})();

const infuraApiKey: string = (() => {
  const s = process.env['REACT_APP_INFURA_API_KEY'];
  if (s === undefined) {
    console.error("REACT_APP_INFURA_API_KEY undefined");
    return 'REACT_APP_INFURA_API_KEY_undefined';
  } else return s;
})();

// TODO semi-automate discovery of new alchemyHttpUrls, eg. by writing a tool to check for new endpoints for chains not yet supported here
const alchemyHttpUrls: Readonly<{ [chainId: number]: string }> = isProduction ? {
  // ********* BEGIN PRODUCTION networks *********
  [mainnet.id]: `https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
  [optimism.id]: `https://opt-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
  [arbitrum.id]: `https://arb-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
  [base.id]: `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
  [zkSync.id]: `https://zksync-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
  [zora.id]: `https://zora-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
  [polygonZkEvm.id]: `https://polygonzkevm-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
  [polygon.id]: `https://polygon-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
  // ********* END PRODUCTION networks *********
} : {
  // ********* BEGIN TEST networks *********
  [sepolia.id]: `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`,
  [optimismSepolia.id]: `https://opt-sepolia.g.alchemy.com/v2/${alchemyApiKey}`,
  [arbitrumSepolia.id]: `https://arb-sepolia.g.alchemy.com/v2/${alchemyApiKey}`,
  [baseSepolia.id]: `https://base-sepolia.g.alchemy.com/v2/${alchemyApiKey}`,
  [zkSyncSepolia.id]: `https://zksync-sepolia.g.alchemy.com/v2/${alchemyApiKey}`,
  [zoraSepolia.id]: `https://zora-sepolia.g.alchemy.com/v2/${alchemyApiKey}`,
  [polygonZkEvmCardona.id]: `https://polygonzkevm-cardona.g.alchemy.com/v2/${alchemyApiKey}`,
  [polygonAmoy.id]: `https://polygon-amoy.g.alchemy.com/v2/${alchemyApiKey}`,
  // ********* END TEST networks *********
};

// TODO semi-automate discovery of new infuraHttpUrls, eg. by writing a tool to check for new endpoints for chains not yet supported here
const infuraHttpUrls: Readonly<{ [chainId: number]: string }> = isProduction ? {
  // ********* BEGIN PRODUCTION networks *********
  [mainnet.id]: `https://mainnet.infura.io/v3/${infuraApiKey}`,
  [optimism.id]: `https://optimism-mainnet.infura.io/v3/${infuraApiKey}`,
  [arbitrum.id]: `https://arbitrum-mainnet.infura.io/v3/${infuraApiKey}`,
  [linea.id]: `https://linea-mainnet.infura.io/v3/${infuraApiKey}`,
  [blast.id]: `https://blast-mainnet.infura.io/v3/${infuraApiKey}`,
  [polygon.id]: `https://polygon-mainnet.infura.io/v3/${infuraApiKey}`,
  // ********* END PRODUCTION networks *********
} : {
  // ********* BEGIN TEST networks *********
  [sepolia.id]: `https://sepolia.infura.io/v3/${infuraApiKey}`,
  [optimismSepolia.id]: `https://optimism-sepolia.infura.io/v3/${infuraApiKey}`,
  [arbitrumSepolia.id]: `https://arbitrum-sepolia.infura.io/v3/${infuraApiKey}`,
  [lineaSepolia.id]: `https://linea-sepolia.infura.io/v3/${infuraApiKey}`,
  [blastSepolia.id]: `https://blast-sepolia.infura.io/v3/${infuraApiKey}`,
  [polygonAmoy.id]: `https://polygon-amoy.infura.io/v3/${infuraApiKey}`,
  // ********* END TEST networks *********
};

export function alchemyHttpUrl(chainId: number): string | undefined {
  return alchemyHttpUrls[chainId];
}

export function infuraHttpUrl(chainId: number): string | undefined {
  return infuraHttpUrls[chainId];
}

// Sanity tests:
// TODO conditional compilation of these sanity tests using macros and/or move these to unit tests
(() => {
  for (const chainIdRaw of Object.keys(alchemyHttpUrls)) {
    const chainId = parseInt(chainIdRaw);
    if (isNaN(chainId)) console.error(`alchemyHttpUrls has chainId=${chainIdRaw} that wasn't a number`);
    else {
      const c = getChain(chainId);
      if (c === undefined) console.error(`alchemyHttpUrls has an unsupported chainId=${chainId}`);
      else if (c.testnet === isProduction) console.error(`alchemyHttpUrls has as a ${c.testnet ? 'testnet' : 'mainnet'} chain but 3cities is running in ${isProduction ? 'mainnet' : 'testnet'} mode, chainId=${chainId}`);
    }
  }

  for (const chainIdRaw of Object.keys(infuraHttpUrls)) {
    const chainId = parseInt(chainIdRaw);
    if (isNaN(chainId)) console.error(`infuraHttpUrls has chainId=${chainIdRaw} that wasn't a number`);
    else {
      const c = getChain(chainId);
      if (c === undefined) console.error(`infuraHttpUrls has an unsupported chainId=${chainId}`);
      else if (c.testnet === isProduction) console.error(`infuraHttpUrls has as a ${c.testnet ? 'testnet' : 'mainnet'} chain but 3cities is running in ${isProduction ? 'mainnet' : 'testnet'} mode, chainId=${chainId}`);
    }
  }
})();
