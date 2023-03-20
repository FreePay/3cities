import { IntRange } from "./IntRange";

// Token is our type for fungible (ERC-20) tokens. An instance of
// Token represents a token's definition and not a balance denominated
// in that token. For balances, see TokenBalance.
export type Token = Readonly<{
  name: string;
  ticker: string;
  decimals: IntRange<0, 19>;
  chainId: number;
  contractAddress: `0x${string}`;
}>

// NativeCurrency is our type for each chain's native currency, eg.
// ETH for the L1. An instance of NativeCurrency represents a native
// currency's definition and not a balance denominated in that native
// currency. For balances (for both tokens and native currencies), see
// TokenBalance.
export type NativeCurrency = Readonly<{
  name: string;
  ticker: string;
  decimals: 18; // all EVM chains should implement 18 decimals in their native currencies in order to remain compatible with solidity
  chainId: number;
  contractAddress?: never;
}>

// const t: Token = { name: 'Test', ticker: 'T', decimals: 18, chainId: 5, contractAddress: "0x123" };
// const nc: NativeCurrency = { name: 'Test2', ticker: 'T2', decimals: 18, chainId: 5 };
// const fails: NativeCurrency = t;
// const fails2: Token = nc;
