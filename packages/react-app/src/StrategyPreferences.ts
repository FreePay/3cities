
type AllowlistOrDenylist<T> = Readonly<{
  allowlist: Set<T>;
  denylist?: never;
} | {
  allowlist?: never;
  denylist: Set<T>;
}>;

// StrategyPreferences are preferences expressed by one or more
// counterparties that restrict and/or shape the set of strategies (or
// proposed strategies) available to settle a payment. The idea here is
// to allow a receiver/seller to say eg., "I don't care what chain you
// send me tokens on, but I don't want Tether".
export type StrategyPreferences = Readonly<{
  acceptedTokenTickers?: AllowlistOrDenylist<string>, // list of token tickers in which payment must (if allowlist) or must not (if denylist) be received
  acceptedChainIds?: AllowlistOrDenylist<number>, // list of chain ids on which payment must (if allowlist) or must not (if denylist) be received
  // TODO soft preferences that are evaluated on a best-effort basis eg. "I prefer USD over EUR where possible", eg. "I prefer Arbitrum One where possible"
}>

// TODO for the StrategyPreferences editor UX, consider opinionated categorizations like "Top stablecoins" or "Most-trusted stablecoins" or "L2s" so that people could do stuff like "I'll accept top stablecoins on L2s" and that would automatically be an allowlist of any top stablecoin (according to the definition maintained by 3cities, like a tokenlist) and any L2 (again, according to 3cities list of L2s, ie. excluding sidechains and the L1).
