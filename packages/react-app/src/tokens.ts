import { arbitrum, arbitrumGoerli, baseGoerli, goerli, mainnet, optimism, optimismGoerli, polygonZkEvmTestnet, scrollTestnet } from '@wagmi/core/chains';
import { allSupportedChainIds, arbitrumNova, polygonZkEvm, taikoTestnet, zkSync, zkSyncTestnet } from "./chains";
import { isProduction } from "./isProduction";
import { NonEmptyArray } from "./NonEmptyArray";
import { NativeCurrency, Token } from "./Token";

// ***************************************************************
const isTestShorterListOfTokens = false; // WARNING test flag to be manually toggled during develpment to cull the list of supported tokens down to a minimal set for testing purposes
// ***************************************************************

// NB the EF recommends that new app testing occur on the Sepolia
// testnet, and that validating/staking testing occur on the Goerli
// testnet. We'd prefer to follow this recommendation and use Sepolia
// for all testing. However, Sepolia currently does not have official
// testnet deployments for most of gwthe tokens and L2s we use. For
// example, none of DAI, USDT, or USDC have official deployments on
// Sepolia. So, we currently use Goerli wherever possible and don't
// use Sepolia. TODO migrate off Goerli to Sepolia
// https://ethereum.org/en/developers/docs/networks/#sepolia
// https://chainlist.org/

// WARNING currencies defined here won't actually work at runtime
// unless their chainId has a corresponding provider defined in our
// wagmi config. NB this also acts as a protective feature where
// production tokens defined here (eg. real ETH or DAI) won't work at
// all if a production provider isn't defined in the active wagmi
// config.

// By our convention, in our token registry, every production network
// has zero or one testnets. Here, we have adopted Goerli as the
// single testnet for mainnet. See above note on Goerli vs Sepolia.
// Mainnet chainId: 1
// Goerli chainId: 5
const ETH: NativeCurrency = { name: 'Ether', ticker: 'ETH', chainId: mainnet.id, decimals: 18 };
const GoerliETH: NativeCurrency = { name: 'Ether', ticker: 'ETH', chainId: goerli.id, decimals: 18 };
const WETH: Token = { name: 'Wrapped Ether', ticker: 'WETH', chainId: mainnet.id, contractAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 };
const GoerliWETH: Token = { name: 'Wrapped Ether', ticker: 'WETH', chainId: goerli.id, contractAddress: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6', decimals: 18 };
const DAI: Token = { name: 'Dai', ticker: 'DAI', chainId: mainnet.id, contractAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 };
const GoerliDAI: Token = { name: 'Dai', ticker: 'DAI', chainId: goerli.id, contractAddress: '0x11fE4B6AE13d2a6055C8D9cF65c55bac32B5d844', decimals: 18 };
const USDC: Token = { name: 'USD Coin', ticker: 'USDC', chainId: mainnet.id, contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6 };
const GoerliUSDC: Token = { name: 'USD Coin', ticker: 'USDC', chainId: goerli.id, contractAddress: '0x07865c6E87B9F70255377e024ace6630C1Eaa37F', decimals: 6 };
const USDT: Token = { name: 'Tether USD', ticker: 'USDT', chainId: mainnet.id, contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6 };
const GoerliUSDT: Token = { name: 'Tether USD', ticker: 'USDT', chainId: goerli.id, contractAddress: '0xC2C527C0CACF457746Bd31B2a698Fe89de2b6d49', decimals: 6 };
const LUSD: Token = { name: 'Liquity USD', ticker: 'LUSD', chainId: mainnet.id, contractAddress: '0x5f98805A4E8be255a32880FDeC7F6728C6568bA0', decimals: 18 };
// TODO GoerliLUSD

// Optimism L2 token list (see very useful reference for mainnet, Optimism Goerli, Goerli, and other chains https://static.optimism.io/optimism.tokenlist.json)
// Optimism mainnet chainId: 10
// Optimism mainnet block explorer: https://optimistic.etherscan.io/
// Optimism Goerli chainId: 420
// Optimism Goerli block explorer: https://goerli-optimism.etherscan.io/
const OptimismETH: NativeCurrency = { name: 'Ether', ticker: 'ETH', chainId: optimism.id, decimals: 18 };
const OptimismGoerliETH: NativeCurrency = { name: 'Ether', ticker: 'ETH', chainId: optimismGoerli.id, decimals: 18 };
const OptimismWETH: Token = { name: 'Wrapped Ether', ticker: 'WETH', chainId: optimism.id, contractAddress: '0x4200000000000000000000000000000000000006', decimals: 18 };
const OptimismGoerliWETH: Token = { name: 'Wrapped Ether', ticker: 'WETH', chainId: optimismGoerli.id, contractAddress: '0x4200000000000000000000000000000000000006', decimals: 18 };
const OptimismDAI: Token = { name: 'Dai', ticker: 'DAI', chainId: optimism.id, contractAddress: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18 };
const OptimismGoerliDAI: Token = { name: 'Dai', ticker: 'DAI', chainId: optimismGoerli.id, contractAddress: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18 };
const OptimismUSDC: Token = { name: 'USD Coin', ticker: 'USDC', chainId: optimism.id, contractAddress: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', decimals: 6 };
const OptimismGoerliUSDC: Token = { name: 'USD Coin', ticker: 'USDC', chainId: optimismGoerli.id, contractAddress: '0x7E07E15D2a87A24492740D16f5bdF58c16db0c4E', decimals: 6 };
const OptimismUSDT: Token = { name: 'Tether USD', ticker: 'USDT', chainId: optimism.id, contractAddress: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6 };
const OptimismGoerliUSDT: Token = { name: 'Tether USD', ticker: 'USDT', chainId: optimismGoerli.id, contractAddress: '0x853eb4bA5D0Ba2B77a0A5329Fd2110d5CE149ECE', decimals: 6 };
const OptimismLUSD: Token = { name: 'Liquity USD', ticker: 'LUSD', chainId: optimism.id, contractAddress: '0xc40F949F8a4e094D1b49a23ea9241D289B7b2819', decimals: 18 };
// TODO OptimismGoerliLUSD

// Arbitrum token list: https://tokenlist.arbitrum.io/ArbTokenLists/arbed_arb_whitelist_era.json
// Arbitrum mainnet chainId: 42161
// Arbitrum block explorer: https://arbiscan.io/
// Arbitrum Goerli chainId: 421613
// Arbitrum Goerli block explorer #1 https://testnet.arbiscan.io/
// Arbitrum Goerli block explorer #2 https://goerli-rollup-explorer.arbitrum.io/
const ArbitrumETH: NativeCurrency = { name: 'Ether', ticker: 'ETH', chainId: arbitrum.id, decimals: 18 };
const ArbitrumGoerliETH: NativeCurrency = { name: 'Ether', ticker: 'ETH', chainId: arbitrumGoerli.id, decimals: 18 };
const ArbitrumWETH: Token = { name: 'Wrapped Ether', ticker: 'WETH', chainId: arbitrum.id, contractAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18 };
const ArbitrumGoerliWETH: Token = { name: 'Wrapped Ether', ticker: 'WETH', chainId: arbitrumGoerli.id, contractAddress: '0xe39Ab88f8A4777030A534146A9Ca3B52bd5D43A3', decimals: 18 };
const ArbitrumDAI: Token = { name: 'Dai', ticker: 'DAI', chainId: arbitrum.id, contractAddress: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18 };
const ArbitrumGoerliDAI: Token = { name: 'Dai', ticker: 'DAI', chainId: arbitrumGoerli.id, contractAddress: '0x8411120Df646D6c6DA15193Ebe9E436c1c3a5222', decimals: 18 };
const ArbitrumUSDC: Token = { name: 'USD Coin', ticker: 'USDC', chainId: arbitrum.id, contractAddress: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', decimals: 6 };
const ArbitrumGoerliUSDC: Token = { name: 'USD Coin', ticker: 'USDC', chainId: arbitrumGoerli.id, contractAddress: '0x8FB1E3fC51F3b789dED7557E680551d93Ea9d892', decimals: 6 };
const ArbitrumUSDT: Token = { name: 'Tether USD', ticker: 'USDT', chainId: arbitrum.id, contractAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 };
const ArbitrumGoerliUSDT: Token = { name: 'Tether USD', ticker: 'USDT', chainId: arbitrumGoerli.id, contractAddress: '0xB401e876346B3C77DD51781Efba5223d2F1e6697', decimals: 6 };
const ArbitrumLUSD: Token = { name: 'Liquity USD', ticker: 'LUSD', chainId: arbitrum.id, contractAddress: '0x93b346b6BC2548dA6A1E7d98E9a421B42541425b', decimals: 18 };
// TODO ArbitrumGoerliLUSD

// Arbitrum Nova mainnet chainId: 42170
// Arbitrum Nova block explorer: https://nova.arbiscan.io
// Arbitrum Nova testnet (none)
const ArbitrumNovaETH: NativeCurrency = { name: 'Ether', ticker: 'ETH', chainId: arbitrumNova.id, decimals: 18 };
// const ArbitrumNovaWETH // Slingshot DEX and a few other sources seem to report the ArbitrumNovaWETH contract as https://nova-explorer.arbitrum.io/token/0x722E8BdD2ce80A4422E880164f2079488e115365/token-transfers . However, I don't understand why this contract is an upgradable proxy instead of an immutable WETH contract, so I have not listed it for now. TODO investigate
const ArbitrumNovaDAI: Token = { name: 'Dai', ticker: 'DAI', chainId: arbitrumNova.id, contractAddress: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18 };
const ArbitrumNovaUSDC: Token = { name: 'USD Coin', ticker: 'USDC', chainId: arbitrumNova.id, contractAddress: '0x750ba8b76187092B0D1E87E28daaf484d1b5273b', decimals: 6 };
// TODO USDT
// TODO LUSD

// zkSync and zkSyncTestnet
const zkSyncETH: NativeCurrency = { name: 'Ether', ticker: 'ETH', chainId: zkSync.id, decimals: 18 };
const zkSyncTestnetETH: NativeCurrency = { name: 'Ether', ticker: 'ETH', chainId: zkSyncTestnet.id, decimals: 18 };
// TODO does zkSync use WETH?
const zkSyncUSDC: Token = { name: 'USD Coin', ticker: 'USDC', chainId: zkSync.id, contractAddress: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', decimals: 6 };
const zkSyncTestnetUSDC: Token = { name: 'USD Coin', ticker: 'USDC', chainId: zkSyncTestnet.id, contractAddress: '0x0faF6df7054946141266420b43783387A78d82A9', decimals: 6 };
// TODO mainnet DAI
const zkSyncTestnetDAI: Token = { name: 'Dai', ticker: 'DAI', chainId: zkSyncTestnet.id, contractAddress: '0x3e7676937A7E96CFB7616f255b9AD9FF47363D4b', decimals: 18 };
// TODO USDT
// TODO LUSD

// polygonZkEvm and polygonZkEvmTestnet
// mainnet bridge https://bridge.zkevm-rpc.com
// testnet bridge https://public.zkevm-test.net/login
const PolygonZkEvmETH: NativeCurrency = { name: 'Ether', ticker: 'ETH', chainId: polygonZkEvm.id, decimals: 18 };
const PolygonZkEvmTestnetETH: NativeCurrency = { name: 'Ether', ticker: 'ETH', chainId: polygonZkEvmTestnet.id, decimals: 18 };
// TODO PolygonZkEvmWETH
const PolygonZkEvmTestnetWETH: Token = { name: 'Wrapped Ether', ticker: 'WETH', chainId: polygonZkEvmTestnet.id, contractAddress: '0x3ce1bab7b7bAE26775F81Ee3576a99f0EAd5B33C', decimals: 18 };
const PolygonZkEvmUSDC: Token = { name: 'USD Coin', ticker: 'USDC', chainId: polygonZkEvm.id, contractAddress: '0xA8CE8aee21bC2A48a5EF670afCc9274C7bbbC035', decimals: 6 };
// const PolygonZkEvmTestnetUSDC: Token = { name: 'USD Coin', ticker: 'USDC', chainId: polygonZkEvmTestnet.id, contractAddress: '', decimals: 6 }; // TODO get contract address (I couldn't bridge test USDC because I couldn't find any test USDC matching the contract polygon's test bridge uses, and I stopped there.)
const PolygonZkEvmDAI: Token = { name: 'Dai', ticker: 'DAI', chainId: polygonZkEvm.id, contractAddress: '0xC5015b9d9161Dca7e18e32f6f25C4aD850731Fd4', decimals: 18 };
// const PolygonZkEvmTestnetDAI: Token = { name: 'Dai', ticker: 'DAI', chainId: polygonZkEvmTestnet.id, contractAddress: '', decimals: 18 }; // TODO get contract address (I couldn't bridge test USDC their test bridge doesn't list USDC, and I wasn't sure which goerli USDC contract might be preferred, and I stopped there.)
// TODO USDT
const PolygonZkEvmLUSD: Token = { name: 'Liquity USD', ticker: 'LUSD', chainId: polygonZkEvm.id, contractAddress: '0x01E9A866c361eAd20Ab4e838287DD464dc67A50e', decimals: 18 };
// TODO PolygonZkEvmTestnetLUSD

// Base mainnet chainId: 8453 (Base mainnet is not yet launched)
// Base block explorer: https://basescan.org/
// Base Goerli chainId: 84531
// Base Goerli block explorer https://goerli.basescan.org/
const BaseGoerliETH: NativeCurrency = { name: 'Ether', ticker: 'ETH', chainId: baseGoerli.id, decimals: 18 };
const BaseGoerliDAI: Token = { name: 'Dai', ticker: 'DAI', chainId: baseGoerli.id, contractAddress: '0x7805e80523536fb4872a1cee2c53c4f354953b96', decimals: 18 };

// Scroll Goerli Alpha chainId: 534353
// Scroll Goerli Alpha block explorer: https://blockscout.scroll.io/
// Scroll Goerli Alpha block explorer #2: https://scroll.io/alpha/rollupscan
const ScrollGoerliETH: NativeCurrency = { name: 'Ether', ticker: 'ETH', chainId: scrollTestnet.id, decimals: 18 };
const ScrollGoerliUSDC: Token = { name: 'USD Coin', ticker: 'USDC', chainId: scrollTestnet.id, contractAddress: '0xa0d71b9877f44c744546d649147e3f1e70a93760', decimals: 18 }; // NB this particular test USDC has 18 decimals instead of USDC's usual 6
const ScrollGoerliDAI: Token = { name: 'Dai', ticker: 'DAI', chainId: scrollTestnet.id, contractAddress: '0x3dF3514437FcdF5c4F714b7025b625b9Acb3e9E1', decimals: 18 }; // this is a random DAI plucked from the explorer and isn't listed in the scroll bridge

// Taiko testnet
const TaikoTestnetETH: NativeCurrency = { name: 'Ether', ticker: 'ETH', chainId: taikoTestnet.id, decimals: 18 };
const TaikoTestnetUSDC: Token = { name: 'USD Coin', ticker: 'USDC', chainId: taikoTestnet.id, contractAddress: '0xCea5BFE9542eDf828Ebc2ed054CA688f0224796f', decimals: 18 }; // NB this is actually the HORSE token on taiko A2 https://explorer.a2.taiko.xyz/token/0xCea5BFE9542eDf828Ebc2ed054CA688f0224796f/token-transfers
const TaikoTestnetDAI: Token = { name: 'Dai', ticker: 'DAI', chainId: taikoTestnet.id, contractAddress: '0x6048e5ca54c021D39Cd33b63A44980132bcFA66d', decimals: 18 }; // NB this is actually the BLL (Bull) token on taiko A2 https://explorer.a2.taiko.xyz/token/0x6048e5ca54c021D39Cd33b63A44980132bcFA66d/token-transfers

function isTokenOnASupportedChain(token: NativeCurrency | Token): boolean {
  return allSupportedChainIds.indexOf(token.chainId) > -1;
}

// nativeCurrencies is our static global definition of all supported
// native currencies for all supported chains.
export const nativeCurrencies: Readonly<NonEmptyArray<NativeCurrency>> = (() => {
  const ts = (isProduction ? [
    ETH,
    OptimismETH,
    ArbitrumETH,
    ArbitrumNovaETH,
    zkSyncETH,
    PolygonZkEvmETH,
  ] : [
    GoerliETH,
    OptimismGoerliETH,
    ArbitrumGoerliETH,
    zkSyncTestnetETH,
    PolygonZkEvmTestnetETH,
    BaseGoerliETH,
    ScrollGoerliETH,
    TaikoTestnetETH,
  ]).filter(isTokenOnASupportedChain); // here we must drop tokens on unsupported chains to ensure that all tokens in our registry are in fact on supported chains so that our token and chain registries are consistent with each other
  const t0 = ts[0];
  if (t0 === undefined) throw new Error(`nativeCurrencies: set of supported nativeCurrencies is empty`);
  else return [t0, ...ts.slice(1)];
})();

// tokens is our static global definition of all supported erc20 tokens for all supported chains.
export const tokens: Readonly<NonEmptyArray<Token>> = (() => {
  const ts = (isProduction ? [
    // Here we group the tokens by ticker and not chain because `tokens` is used to generate the canonical token ordering in allTokenKeys and our supposition is that in a multichain UX, the user would rather see all their DAIs together than all their Optimism assets, although this is somewhat contrary to how the rest of the ecosystem works right now where most apps support connecting to only one chain at a time and so naturally render all assets for one chain, effectively sorting by chain before ticker
    WETH,
    OptimismWETH,
    ArbitrumWETH,
    DAI,
    OptimismDAI,
    ArbitrumDAI,
    ArbitrumNovaDAI,
    PolygonZkEvmDAI,
    USDC,
    OptimismUSDC,
    ArbitrumUSDC,
    ArbitrumNovaUSDC,
    zkSyncUSDC,
    PolygonZkEvmUSDC,
    USDT,
    OptimismUSDT,
    ArbitrumUSDT,
    LUSD,
    OptimismLUSD,
    ArbitrumLUSD,
    PolygonZkEvmLUSD,
  ] : [
    GoerliWETH,
    OptimismGoerliWETH,
    ArbitrumGoerliWETH,
    PolygonZkEvmTestnetWETH,
    GoerliDAI,
    OptimismGoerliDAI,
    ArbitrumGoerliDAI,
    zkSyncTestnetDAI,
    ScrollGoerliDAI,
    TaikoTestnetDAI,
    BaseGoerliDAI,
    GoerliUSDC,
    OptimismGoerliUSDC,
    ArbitrumGoerliUSDC,
    zkSyncTestnetUSDC,
    ScrollGoerliUSDC,
    TaikoTestnetUSDC,
    GoerliUSDT,
    OptimismGoerliUSDT,
    ArbitrumGoerliUSDT,
  ].filter((t) => !isTestShorterListOfTokens || t.ticker === 'USDC') // ie. drop all tokens but one ticker if this test flag is set to help test with a shorter list of tokens
  ).filter(isTokenOnASupportedChain); // here we must drop tokens on unsupported chains to ensure that all tokens in our registry are in fact on supported chains so that our token and chain registries are consistent with each other
  const t0 = ts[0];
  if (t0 === undefined) throw new Error(`tokens: set of supported tokens is empty`);
  else return [t0, ...ts.slice(1)];
})();

export type TokenKey = string // see getTokenKey

// getTokenKey returns a string that uniquely identifies the passed
// NativeCurrency or Token, suitable to be used as a hashing or object
// key.
export function getTokenKey(t: NativeCurrency | Token): TokenKey {
  return `${t.ticker}-${t.chainId}`;
}

// allTokenKeys is a list of all TokenKeys for both nativeCurrencies
// and tokens that also provides a canonical ordering of all TokenKeys
// to help clients display tokens in a deterministic, stable order.
export const allTokenKeys: Readonly<TokenKey[]> = (() => {
  const tks: TokenKey[] = [];
  for (const nc of nativeCurrencies) {
    tks.push(getTokenKey(nc));
  }
  for (const t of tokens) {
    tks.push(getTokenKey(t));
  }
  return tks;
})();

const tokensByTokenKey: Readonly<{ [tk: TokenKey]: NativeCurrency | Token }> = (() => {
  const r: { [tk: TokenKey]: NativeCurrency | Token } = {};
  for (const nc of nativeCurrencies) {
    r[getTokenKey(nc)] = nc;
  }
  for (const t of tokens) {
    r[getTokenKey(t)] = t;
  }
  return r;
})();

// tokensByTicker is a look-up table of the set of canonical
// Token/NativeCurrency instances for each token ticker. Eg.
// tokensByTicker['DAI'] = [/* DAI instances on all chains */]
export const tokensByTicker: Readonly<{ [ticker: string]: NonEmptyArray<NativeCurrency | Token> }> = (() => {
  const r: { [ticker: string]: NonEmptyArray<NativeCurrency | Token> } = {};
  for (const nc of nativeCurrencies) {
    const e = r[nc.ticker];
    if (e === undefined) r[nc.ticker] = [nc];
    else e.push(nc);
  }
  for (const t of tokens) {
    const e = r[t.ticker];
    if (e === undefined) r[t.ticker] = [t];
    else e.push(t);
  }
  return r;
})();

// allTokenTickers is the set of all token tickers we support
export const allTokenTickers = Object.keys(tokensByTicker);

// getTokenByTokenKey returns a NativeCurrency or Token for the passed
// TokenKey. For convenience, getTokenByTokenKey is a partial function
// that throws an error if the passed TokenKey is not found in the
// global cache. Alternatively, getTokenByTokenKey could have returned
// `NativeCurrency | Token | undefined` which would be less
// convenient.
export function getTokenByTokenKey(tk: TokenKey): NativeCurrency | Token {
  const t = tokensByTokenKey[tk];
  if (t === undefined) throw new Error(`getTokenByTokenKey: unknown TokenKey: ${tk}`);
  return t;
}

// isToken is a TypeScript type assertion helper function to match
// `NativeCurrency | Token` into `Token` or `NativeCurrency`
export function isToken(o: NativeCurrency | Token): o is Token {
  return Object.prototype.hasOwnProperty.call(o, "contractAddress");
}

// Sanity tests:
if (isToken(ETH)) throw new Error(`isToken implementation error: ETH recognized as a token`);
if (!isToken(WETH)) throw new Error(`isToken implementation error: WETH not recognized as a token`);

// getDecimalsToRenderForTokenTicker returns the canonical number of
// digits after the decimal point to render for a token based on its
// passed ticker.
export function getDecimalsToRenderForTokenTicker(ticker: string): number {
  switch (ticker) {
    case ETH.ticker: return 4;
    case DAI.ticker: return 2;
    case USDC.ticker: return 2;
    case USDT.ticker: return 2;
  }
  return 2;
}
