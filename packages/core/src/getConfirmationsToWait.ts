import { arbitrum, arbitrumNova, arbitrumSepolia, base, baseSepolia, blast, blastSepolia, chainsSupportedBy3cities, fluentTestnet, getChain, immutableZkEvm, linea, lineaSepolia, mainnet, mode, optimism, optimismSepolia, polygon, polygonAmoy, polygonZkEvm, polygonZkEvmCardona, scroll, scrollSepolia, sepolia, taiko, zkSync, zkSyncSepolia, zora, zoraSepolia } from './chains';
import { isProduction } from './isProduction';

// These numbers were put together with low confidence
// See https://developers.circle.com/circle-mint/docs/blockchain-confirmations
// See https://developer.ipeakoin.com/docs/blockchain-confirmations
const confirmationsToWait: { [chainId: number]: number } = isProduction ? {
  // ********* BEGIN PRODUCTION networks *********
  [arbitrum.id]: 360, // ~1.5 minutes
  [arbitrumNova.id]: 90, // ~3 minutes
  [base.id]: 90, // ~3 minutes
  [blast.id]: 90, // ~3 minutes
  [immutableZkEvm.id]: 60, // ~3 minutes
  [linea.id]: 10, // // 20 seconds. This is because Linea has a 2-second block time, and per Linea core team the Linea L2 never reorgs, and they've recommended 10 blocks as sufficiently conservative
  [mainnet.id]: 15, // ~3 minutes
  [mode.id]: 60, // ~3 minutes
  [optimism.id]: 90, // ~3 minutes
  [polygon.id]: 372, // ~20 minutes
  [polygonZkEvm.id]: 60, // ~3 minutes
  [scroll.id]: 60, // ~3 minutes
  [taiko.id]: 15, // ~3 minutes
  [zkSync.id]: 7_200, // ~2 hours. NB Circle waits "~35 Ethereum blocks after the proof for the batch is posted to the L1." which they estimate as ~2 hours, and so we wait ~2 hours' worth of L2 blocks at 1 second per block
  [zora.id]: 90, // ~3 minutes
  // ********* END PRODUCTION networks *********
} : {
  // ********* BEGIN TEST networks *********
  [arbitrumSepolia.id]: 360, // ~1.5 minutes
  [baseSepolia.id]: 90, // ~3 minutes
  [blastSepolia.id]: 90, // ~3 minutes
  [fluentTestnet.id]: 1, // currently in early stage with very long blocktimes
  [lineaSepolia.id]: 90, // ~3 minutes
  [optimismSepolia.id]: 90, // ~3 minutes
  [polygonAmoy.id]: 372, // ~20 minutes
  [polygonZkEvmCardona.id]: 60, // ~3 minutes
  [scrollSepolia.id]: 15, // ~3 minutes
  [sepolia.id]: 15, // ~3 minutes
  [zkSyncSepolia.id]: 7_200, // ~2 hours
  [zoraSepolia.id]: 90, // ~3 minutes
  // ********* END TEST networks *********
};

// getConfirmationsToWait returns the number of confirmations that
// 3cities should wait per chain before assuming a transaction is likely
// permanently included. This doesn't meet the technical definition of
// finalization.
export function getConfirmationsToWait(chainId: number): number | undefined {
  return confirmationsToWait[chainId];
}

// Sanity tests:
// TODO conditional compilation of these sanity tests using macros, eg. using ENABLE_SANITY_TESTS=true and/or move these to unit tests
(() => {
  const cs = chainsSupportedBy3cities.filter(c => getConfirmationsToWait(c.id) === undefined);
  if (cs.length > 0) {
    throw new Error(`getConfirmationsToWait is not defined for all chains. Undefined for ${cs.map(c => `(chain=${c.name} chainId=${c.id})`).join(', ')}`);
  }
})();
(() => {
  for (const chainIdRaw of Object.keys(confirmationsToWait)) {
    const chainId = parseInt(chainIdRaw);
    if (isNaN(chainId)) console.error(`confirmationsToWait has chainId=${chainIdRaw} that wasn't a number`);
    else {
      const c = getChain(chainId);
      if (c === undefined) console.error(`confirmationsToWait has an unsupported chainId=${chainId}`);
      else if (c.testnet === isProduction) console.error(`confirmationsToWait has as a ${c.testnet ? 'testnet' : 'mainnet'} chain but 3cities is running in ${isProduction ? 'mainnet' : 'testnet'} mode, chainId=${chainId}`);
    }
  }
})();
