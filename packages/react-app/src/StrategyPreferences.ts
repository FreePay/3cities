// StrategyPreferences are preferences expressed by one or more
// counterparties that restrict and/or shape the set of strategies (or
// proposed strategies) available to fulfill an agreement (or proposed
// agreement). The idea here is to allow a seller to say eg., "I don't
// care what chain you send me tokens on, but I don't want Tether".
export type StrategyPreferences = {
  tokenTickerExclusions?: string[]; // list of tokenTickers (ie. NativeCurrency.ticker or Token.ticker) that should be ignored when computing agreement execution strategies. Eg. if a user didn't want to transact in Tether, they may set `tokenTickerExclusions: ['USDT']`
  chainIdExclusions?: number[]; // list of chainIds that should be ignored when computing agreement execution strategies. Eg. if a user didn't want to transact on mainnet, they may set `chainIdExclusions: [1]`
};

// TODO we may need to support inclusions/allowlist has well as exclusions because eg. consider a customer like Week in Eth News, they only want specific tokens on specific chains of their choosing --> consider Week In Eth starts using 3c, and then we later add support for a new chain or stablecoin --> we wouldn't want Week in Eth News to automatically begin accepting this new chain and stablecoin --> implies an allowlist instead of a denylist

// TODO for the StrategyPreferences editor UX, consider opinionated categorizations like "Top stablecoins" or "Most-trusted stablecoins" or "L2s" so that people could do stuff like "I'll accept top stablecoins on L2s" and that would automatically be an allowlist of any top stablecoin (according to the definition maintained by 3cities, like a tokenlist) and any L2 (again, according to 3cities list of L2s, ie. excluding sidechains and the L1).

// TODO we also want the StrategyPreferences editor in RequestMoney to support easy batch toggling like "toggle all tokens/chains off". For example, if a customer wanted to accept only USDC on Polygon, they would first toggle off all tokens, and then toggle on USDC, and then toggle off all chains, and then toggle on Polygon. However, this still doesn't get them all the way: because of the current denylist model, they are implicitly opting into any future tokens or chains. So we need to expand the data structure to support allowlisting, but also to expand the UI for allowlisting as well as batch operations. What's a good mass-market UX to chooes between a denylist or allowlist model? This is probably a good one for customer conversations: do customers tend to think in allowlists or denylists? I suspect they think in allowlists, but I want to discourage people from allowlists because implicitly gaining new tokens+chains for the same generated link over time seems like a good benefit. Example: start accepting donations on any chain but mainnet, and automatically gain new L2s as they get added to 3cities.
