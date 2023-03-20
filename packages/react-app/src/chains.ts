import { arbitrum, arbitrumGoerli, baseGoerli, goerli, mainnet, optimism, optimismGoerli, scrollTestnet, zkSyncTestnet } from '@wagmi/core/chains';
import { Chain } from 'wagmi';
import { isProduction } from './isProduction';
import { NonEmptyArray } from './NonEmptyArray';

// ***************************************************************
const isTestShorterListOfChains = false; // WARNING test flag to be manually toggled during develpment to cull the list of supported chains down to a minimal set for testing purposes
// ***************************************************************

export const chainsSupportedBy3cities: NonEmptyArray<Chain> = (() => {
  const cs = ((isProduction ? [
    // ********* BEGIN PRODUCTION networks *********
    mainnet,
    optimism,
    arbitrum,
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
  ]
  ) as Chain[]) // TODO WARNING `as Chain[]` is type unsafe and instead should be updated to `satisfies Chain[]` once VSCode's typescript compiler is updated to 4.9 (the version that introduces the `satisfies` keyword), which I must do myself by most likely switching to VSCodium because MonkeyPatch is permanently broken in VSCode
    .filter((c: Chain) => !isTestShorterListOfChains || c.id === optimismGoerli.id);
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
