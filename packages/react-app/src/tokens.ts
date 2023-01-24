import { Arbitrum, ArbitrumGoerli, Goerli, Mainnet, NativeCurrency, Optimism, OptimismGoerli, Token, ZkSyncTestnet as ZkSyncGoerli } from "@usedapp/core";
import { isProduction } from "./isProduction";
import { NonEmptyArray } from "./NonEmptyArray";

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
// all if a mainnet provider isn't defined in the active wagmi config.

// In our token registry, every production network has a single
// testnet. Here, we have adopted Goerli as the single testnet for
// mainnet per the EF's recommendation to use Goerli for app development 
// Mainnet chainId: 1
// Goerli chainId: 5
const ETH = new NativeCurrency('Ether', 'ETH', Mainnet.chainId);
const GoerliETH = new NativeCurrency('Ether', 'ETH', Goerli.chainId);
const WETH = new Token('Wrapped Ether', 'WETH', Mainnet.chainId, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18);
const GoerliWETH = new Token('Wrapped Ether', 'WETH', Goerli.chainId, '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6', 18);
const DAI = new Token('Dai', 'DAI', Mainnet.chainId, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18);
const GoerliDAI = new Token('Dai', 'DAI', Goerli.chainId, '0x11fE4B6AE13d2a6055C8D9cF65c55bac32B5d844', 18);
const USDC = new Token('USD Coin', 'USDC', Mainnet.chainId, '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 6);
const GoerliUSDC = new Token('USD Coin', 'USDC', Goerli.chainId, '0x07865c6E87B9F70255377e024ace6630C1Eaa37F', 6);
const USDT = new Token('Tether USD', 'USDT', Mainnet.chainId, '0xdac17f958d2ee523a2206206994597c13d831ec7', 6);
const GoerliUSDT = new Token('Tether USD', 'USDT', Goerli.chainId, '0xC2C527C0CACF457746Bd31B2a698Fe89de2b6d49', 6);

// Optimism L2 token list (see very useful reference for mainnet, Optimism Goerli, Goerli, and other chains https://static.optimism.io/optimism.tokenlist.json)
// Optimism mainnet chainId: 10
// Optimism mainnet block explorer: https://optimistic.etherscan.io/
// Optimism Goerli chainId: 420
// Optimism Goerli block explorer: https://goerli-optimism.etherscan.io/
const OptimismETH = new NativeCurrency('Ether', 'ETH', Optimism.chainId);
const OptimismGoerliETH = new NativeCurrency('Ether', 'ETH', OptimismGoerli.chainId);
const OptimismWETH = new Token('Wrapped Ether', 'WETH', Optimism.chainId, '0x4200000000000000000000000000000000000006', 18);
const OptimismGoerliWETH = new Token('Wrapped Ether', 'WETH', OptimismGoerli.chainId, '0x4200000000000000000000000000000000000006', 18);
const OptimismDAI = new Token('Dai', 'DAI', Optimism.chainId, '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1');
const OptimismGoerliDAI = new Token('Dai', 'DAI', OptimismGoerli.chainId, '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1');
const OptimismUSDC = new Token('USD Coin', 'USDC', Optimism.chainId, '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', 6);
const OptimismGoerliUSDC = new Token('USD Coin', 'USDC', OptimismGoerli.chainId, '0x7E07E15D2a87A24492740D16f5bdF58c16db0c4E', 6);
const OptimismUSDT = new Token('Tether USD', 'USDT', Optimism.chainId, '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', 6);
const OptimismGoerliUSDT = new Token('Tether USD', 'USDT', OptimismGoerli.chainId, '0x853eb4bA5D0Ba2B77a0A5329Fd2110d5CE149ECE', 6);

// Arbitrum token list: https://tokenlist.arbitrum.io/ArbTokenLists/arbed_arb_whitelist_era.json
// Arbitrum mainnet chainId: 42161
// Arbitrum block explorer: https://arbiscan.io/
// Arbitrum Goerli chainId: 421613
// Arbitrum Goerli block explorer #1 https://testnet.arbiscan.io/
// Arbitrum Goerli block explorer #2 https://goerli-rollup-explorer.arbitrum.io/
const ArbitrumETH = new NativeCurrency('Ether', 'ETH', Arbitrum.chainId);
const ArbitrumGoerliETH = new NativeCurrency('Ether', 'ETH', ArbitrumGoerli.chainId);
const ArbitrumWETH = new Token('Wrapped Ether', 'WETH', Arbitrum.chainId, '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', 18);
const ArbitrumGoerliWETH = new Token('Wrapped Ether', 'WETH', ArbitrumGoerli.chainId, '0xe39Ab88f8A4777030A534146A9Ca3B52bd5D43A3', 18);
const ArbitrumDAI = new Token('Dai', 'DAI', Arbitrum.chainId, '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1');
const ArbitrumGoerliDAI = new Token('Dai', 'DAI', ArbitrumGoerli.chainId, '0x8411120Df646D6c6DA15193Ebe9E436c1c3a5222');
const ArbitrumUSDC = new Token('USD Coin', 'USDC', Arbitrum.chainId, '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', 6);
const ArbitrumGoerliUSDC = new Token('USD Coin', 'USDC', ArbitrumGoerli.chainId, '0x8FB1E3fC51F3b789dED7557E680551d93Ea9d892', 6);
const ArbitrumUSDT = new Token('Tether USD', 'USDT', Arbitrum.chainId, '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', 6);
const ArbitrumGoerliUSDT = new Token('Tether USD', 'USDT', ArbitrumGoerli.chainId, '0xB401e876346B3C77DD51781Efba5223d2F1e6697', 6);

// ZkSync Goerli token list: https://zksync2-testnet.zkscan.io/tokens
// ZkSync Goerli chainId: 280
const ZkSyncGoerliETH = new NativeCurrency('Ether', 'ETH', ZkSyncGoerli.chainId);
// const ZkSyncGoerliWETH = new Token('Wrapped Ether', 'WETH', ZkSyncGoerli.chainId, 'TODO', 18); // TODO I found a found a contract src for WETH on zkSync 2.0, but I couldn't find a WETH deployment on ZkSync Goerli https://github.com/syncswap/weth --> maybe WETH is intended to not exist on zKSync as some possible consequence of being a zk rollup / emphasizing account abstraction?
const ZkSyncGoerliDAI = new Token('Dai', 'DAI', ZkSyncGoerli.chainId, '0x2E4805d59193E173C9C8125B4Fc8F7f9c7a3a3eD');
const ZkSyncGoerliUSDC = new Token('USD Coin', 'USDC', ZkSyncGoerli.chainId, '0x852a4599217E76aA725F0AdA8BF832a1F57a8A91', 6);
// const ZkSyncGoerliUSDT = new Token('Tether USD', 'USDT', ZkSyncGoerli.chainId, 'TODO', 6); // TODO I didn't yet find a canonical/popular deployment of USDT on zkSync Goerli. The swap app I used to receive DAI and USDC did not support USDT

// TEST a shorter list of native currencies for testing purposes
// export const nativeCurrencies2: Readonly<NonEmptyArray<NativeCurrency>> = isProduction ? [
//   Ether,
// ] : [
//   GoerliETH,
// ];

// nativeCurrencies is our static global definition of all supported native currencies for all supported chains.
export const nativeCurrencies: Readonly<NonEmptyArray<NativeCurrency>> = isProduction ? [
  ETH,
  OptimismETH,
  ArbitrumETH,
] : [
  GoerliETH,
  OptimismGoerliETH,
  ArbitrumGoerliETH,
  ZkSyncGoerliETH,
];

// TEST a shorter list of tokens for testing purposes
// export const tokens2: Readonly<NonEmptyArray<Token>> = isProduction ? [
//   DAI,
// ] : [
//   GoerliDAI,
// ];

// tokens is our static global definition of all supported erc20 tokens for all supported chains.
export const tokens: Readonly<NonEmptyArray<Token>> = isProduction ? [
  // Here we group the tokens by ticker and not chain because `tokens` is used to generate the canonical token ordering in allTokenKeys and our supposition is that in a multichain UX, the user would rather see all their DAIs together than all their Optimism assets, although this is somewhat contrary to how the rest of the ecosystem works right now where most apps support connecting to only one chain at a time and so naturally render all assets for one chain, effectively sorting by chain before ticker
  WETH,
  OptimismWETH,
  ArbitrumWETH,
  DAI,
  OptimismDAI,
  ArbitrumDAI,
  USDC,
  OptimismUSDC,
  ArbitrumUSDC,
  USDT,
  OptimismUSDT,
  ArbitrumUSDT,
] : [
  GoerliWETH,
  OptimismGoerliWETH,
  ArbitrumGoerliWETH,
  GoerliDAI,
  OptimismGoerliDAI,
  ArbitrumGoerliDAI,
  ZkSyncGoerliDAI,
  GoerliUSDC,
  OptimismGoerliUSDC,
  ArbitrumGoerliUSDC,
  ZkSyncGoerliUSDC,
  GoerliUSDT,
  OptimismGoerliUSDT,
  ArbitrumGoerliUSDT,
];

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
  return Object.prototype.hasOwnProperty.call(o, "address");
}

// getDecimalsToRenderForTokenTicker returns the canonical number of
// digits after the decimal point to render for a token based on its
// passed ticker.
export function getDecimalsToRenderForTokenTicker(ticker: string): number {
  switch (ticker) {
    case 'ETH': return 4;
    case 'DAI': return 2;
    case 'USDC': return 2;
    case 'USDT': return 2;
  }
  return 2;
}
