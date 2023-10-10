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
const logicalAssetsToSupportedTokenTickers: Readonly<{ [lat in LogicalAssetTicker]: Readonly<{[tokenTicker: Uppercase<string>]: true }> }> = {
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

// isTokenTickerSupportedByLogicalAsset returns true iff the passed
// logical asset (as identified by the passed logical asset ticker)
// supports the passed tokenTicker. Matching is case-insensitive, so
// clients may pass eg. "stETH" to match "STETH".
export function isTokenTickerSupportedByLogicalAsset(lat: LogicalAssetTicker, tokenTicker: string): boolean {
  return logicalAssetsToSupportedTokenTickers[lat][toUppercase(tokenTicker)] === true;
}

// getNativeCurrenciesAndTokensForLogicalAssetTicker returns the set of
// all native currencies and tokens that are both supported by 3cities
// (by way of our global token registry) and supported by the passed
// logical asset (as identified by the passed logical asset ticker).
export function getNativeCurrenciesAndTokensForLogicalAssetTicker(lat: LogicalAssetTicker): (NativeCurrency | Token)[] {
  const r: (NativeCurrency | Token)[] = [];
  for (const t of Object.keys(logicalAssetsToSupportedTokenTickers[lat])) {
    const maybeTokens = tokensByTicker[t];
    if (maybeTokens !== undefined) r.push(...maybeTokens);
  }
  // console.log("getNativeCurrenciesAndTokensForLogicalAssetTicker lat=", lat, "r=", r);
  return r;
}

/*
  logical assets to tokens examples
    DONE given a logical asset ticker, get all its supported tokens/natives.
      DONE getNativeCurrenciesAndTokensForLogicalAssetTicker
    DONE given list of tokens/natives tickers, filter for ones that are supported by given the logical asset or at least one logical asset
      DONE allTokenTickers.filter(isTokenTickerSupportedByLogicalAsset.bind(null, lat))
      SKIP allTokenTickers.filter(isTokenTickerSupportedByAnyLogicalAsset.bind(null, lats))
    SKIP given a list of logical assets and a list of tokens, return the logical assets that have at least one supported token in the list of tokens.
      SKIP lats.filter(supportsAnyTokenTickers.bind(null, tokenTickers))
    SKIP given a list of tokens, partition them by which logical asset they are supported
*/
