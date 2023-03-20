// StrategyPreferences are preferences expressed by one or more
// counterparties that restrict and/or shape the set of strategies (or
// proposed strategies) available to fulfill an agreement (or proposed
// agreement). The idea here is to allow a seller to say eg., "I don't
// care what chain you send me tokens on, but I don't want Tether".
export type StrategyPreferences = {
  tokenTickerExclusions?: string[]; // list of tokenTickers (ie. NativeCurrency.ticker or Token.ticker) that should be ignored when computing agreement execution strategies. Eg. if a user didn't want to transact in Tether, they may set `tokenTickerExclusions: ['USDT']`
  chainIdExclusions?: number[]; // list of chainIds that should be ignored when computing agreement execution strategies. Eg. if a user didn't want to transact on mainnet, they may set `chainIdExclusions: [1]`
}; // TODO we may need to support inclusions/allowlist has well as exclusions because eg. consider a customer like Week in Eth News, they only want specific tokens on specific chains of their choosing --> consider Week In Eth starts using 3c, and then we later add support for a new chain or stablecoin --> we wouldn't want Week in Eth News to automatically begin accepting this new chain and stablecoin --> implies an allowlist instead of a denylist
