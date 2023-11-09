import { NativeCurrency, Token } from "./Token";
import { LogicalAssetTicker } from "./logicalAssets";
import { toUppercase } from "./toUppercase";
import { tokensByTicker } from "./tokens";

// logicalAssetsToSupportedTokenTickers is our single authoritative
// definition for the set of tokens supported by each logical asset. Our
// definition of "this token is supported by this logical asset" means 1
// unit of this token is equivalent to 1 unit of this logical asset. For
// example, "1 DAI is equivalent to 1 USD". NB token tickers in this
// definition don't actually have to exist in our token registry and be
// supported by our system; if a token ticker doesn't exist, it'll be
// ignored silently at runtime.
const logicalAssetsToSupportedTokenTickers: Readonly<{ [lat in LogicalAssetTicker]: Readonly<{ [tokenTicker: Uppercase<string>]: true }> }> = {
  // WARNING here the illegal state is representable where a token ticker should be supported by at most one currency but the data structure allows token tickers to appear in multiple currencies --> one way to attempt to fix this is to define the mapping in its natural form as Readonly<{ [tt: Uppercase<string>]: LogicalAssetTicker }>, but clients want supported tokens indexed by logical asset tickers, and the reverse mapping is impossible to generate dynamically in typescript without casts (because the mapped type `{ [lat in LogicalAssetTicker]: true }` requires the codomain to be the complete set of all LogicalAssetTickers, and that can't be constructed dynamically). TODO consider using casts to eliminate this representable illegal state
  'ETH': {
    'ETH': true,
    'WETH': true,
  },
  'USD': {
    'DAI': true,
    'USDC': true,
    'USDT': true,
    'LUSD': true,
  },
  'CAD': {
    'CADC': true,
  },
  'EUR': {
    'EURC': true,
    'EURT': true,
  },
};

(() => { // here we verify that the logicalAssetsToSupportedTokenTickers representable illegal state of token tickers being supported by more than one currency doesn't occur
  const tokenTickerSupportCheck = new Map<string, string>();
  Object.entries(logicalAssetsToSupportedTokenTickers).forEach(([logicalAssetTicker, tokens]) => {
    Object.keys(tokens).forEach(tokenTicker => {
      if (tokenTickerSupportCheck.has(tokenTicker)) {
        console.error(`illegal logicalAssetsToSupportedTokenTickers: token ticker '${tokenTicker}' is supported by more than one logical asset: '${logicalAssetTicker}' and '${tokenTickerSupportCheck.get(tokenTicker)}'.`);
      } else tokenTickerSupportCheck.set(tokenTicker, logicalAssetTicker);
    });
  });
})();

// isTokenTickerSupportedByLogicalAsset returns true iff the passed
// logical asset (as identified by the passed logical asset ticker)
// supports the passed tokenTicker. Matching is case-insensitive, so
// clients may pass eg. "stETH" to match "STETH".
export function isTokenTickerSupportedByLogicalAsset(lat: LogicalAssetTicker, tokenTicker: string): boolean {
  return logicalAssetsToSupportedTokenTickers[lat][toUppercase(tokenTicker)] === true;
}

// getAllNativeCurrenciesAndTokensForLogicalAssetTicker returns the set of
// all native currencies and tokens that are both supported by 3cities
// (by way of our global token registry) and supported by the passed
// logical asset (as identified by the passed logical asset ticker).
export function getAllNativeCurrenciesAndTokensForLogicalAssetTicker(lat: LogicalAssetTicker): (NativeCurrency | Token)[] {
  const r: (NativeCurrency | Token)[] = [];
  for (const t of Object.keys(logicalAssetsToSupportedTokenTickers[lat])) {
    const maybeTokens = tokensByTicker[t];
    if (maybeTokens !== undefined) r.push(...maybeTokens);
  }
  // console.log("getAllNativeCurrenciesAndTokensForLogicalAssetTicker lat=", lat, "r=", r);
  return r;
}

/*
  logical assets to tokens examples
    DONE given a logical asset ticker, get all its supported tokens/natives.
      DONE getAllNativeCurrenciesAndTokensForLogicalAssetTicker
    DONE given list of tokens/natives tickers, filter for ones that are supported by given the logical asset or at least one logical asset
      DONE allTokenTickers.filter(isTokenTickerSupportedByLogicalAsset.bind(null, lat))
      SKIP allTokenTickers.filter(isTokenTickerSupportedByAnyLogicalAsset.bind(null, lats))
    SKIP given a list of logical assets and a list of tokens, return the logical assets that have at least one supported token in the list of tokens.
      SKIP lats.filter(supportsAnyTokenTickers.bind(null, tokenTickers))
    SKIP given a list of tokens, partition them by which logical asset they are supported
*/
