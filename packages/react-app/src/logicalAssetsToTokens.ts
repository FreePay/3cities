import { Immutable, castImmutable } from "immer";
import { NativeCurrency, Token } from "./Token";
import { LogicalAssetTicker, allLogicalAssetTickers, getDecimalsToRenderForLogicalAssetTicker, getDefaultTruncateTrailingZeroesForLogicalAssetTicker } from "./logicalAssets";
import { tokensByTicker } from "./tokens";

// logicalAssetsToSupportedNativeCurrencyAndTokenTickers is our single
// authoritative definition for the set of tokens supported by each
// logical asset. Our definition of "this token is supported by this
// logical asset" means 1 unit of this token is equivalent to 1 unit of
// this logical asset. For example, "1 DAI is equivalent to 1 USD". NB
// token tickers in this definition don't actually have to exist in our
// token registry and be supported by our system; if a token ticker
// doesn't exist, it'll be ignored silently at runtime.
const logicalAssetsToSupportedNativeCurrencyAndTokenTickers: Readonly<{ [lat in LogicalAssetTicker]: Immutable<Set<Uppercase<string>>> }> = {
  // WARNING here the illegal state is representable where a native currency or token ticker should be supported by at most one logical asset but the data structure allows token tickers to appear in multiple logical assets --> one way to attempt to fix this is to define the mapping in its natural form as Readonly<{ [tt: Uppercase<string>]: LogicalAssetTicker }>, but clients want supported tokens indexed by logical asset tickers, and the reverse mapping is impossible to generate dynamically in typescript without casts (because the mapped type `{ [lat in LogicalAssetTicker]: true }` requires the codomain to be the complete set of all LogicalAssetTickers, and that can't be constructed dynamically). TODO consider using casts to eliminate this representable illegal state
  'ETH': castImmutable(new Set(['ETH', 'WETH', 'STETH'])),
  'USD': castImmutable(new Set(['DAI', 'USDC', 'USDT', 'LUSD', 'GUSD', 'USDP', 'PYUSD', 'USDGLO'])),
  'CAD': castImmutable(new Set(['CADC'])),
  'EUR': castImmutable(new Set(['EURC', 'EURT'])),
};

(() => { // here we verify that the logicalAssetsToSupportedNativeCurrencyAndTokenTickers representable illegal state of token tickers being supported by more than one logical asset doesn't occur
  const tokenTickerSupportCheck = new Map<string, string>();
  Object.entries(logicalAssetsToSupportedNativeCurrencyAndTokenTickers).forEach(([logicalAssetTicker, tokens]) => {
    tokens.forEach(tokenTicker => {
      if (tokenTickerSupportCheck.has(tokenTicker)) {
        console.error(`illegal logicalAssetsToSupportedNativeCurrencyAndTokenTickers: token ticker '${tokenTicker}' is supported by more than one logical asset: '${logicalAssetTicker}' and '${tokenTickerSupportCheck.get(tokenTicker)}'.`);
      } else tokenTickerSupportCheck.set(tokenTicker, logicalAssetTicker);
    });
  });
})();

const supportedNativeCurrencyAndTokenTickersToLogicalAssets: Readonly<{ [tokenTicker: Uppercase<string>]: LogicalAssetTicker }> = (() => {
  const r: { [tokenTicker: Uppercase<string>]: LogicalAssetTicker } = {};
  allLogicalAssetTickers.forEach(lat => {
    logicalAssetsToSupportedNativeCurrencyAndTokenTickers[lat].forEach(tt => {
      r[tt] = lat;
    });
  });
  return r;
})();

// getLogicalAssetTickerForTokenOrNativeCurrencyTicker gets the logical
// asset ticker for the passed token ticker, or returns undefined if
// none exists. For example, USDC's logical asset ticker is USD, and
// UNI's logical asset ticker is undefined because 1 unit of UNI is not
// pegged to any logical asset.
export function getLogicalAssetTickerForTokenOrNativeCurrencyTicker(tt: Uppercase<string>): LogicalAssetTicker | undefined {
  return supportedNativeCurrencyAndTokenTickersToLogicalAssets[tt];
}

// isTokenTickerSupportedByLogicalAsset returns true iff the passed
// logical asset (as identified by the passed logical asset ticker)
// supports the passed tokenTicker. Matching is case-insensitive, so
// clients may pass eg. "stETH" to match "STETH".
export function isTokenTickerSupportedByLogicalAsset(lat: LogicalAssetTicker, tokenTicker: Uppercase<string>): boolean {
  return logicalAssetsToSupportedNativeCurrencyAndTokenTickers[lat].has(tokenTicker);
}

// getAllNativeCurrenciesAndTokensForLogicalAssetTicker returns the set of
// all native currencies and tokens that are both supported by 3cities
// (by way of our global token registry) and supported by the passed
// logical asset (as identified by the passed logical asset ticker).
export function getAllNativeCurrenciesAndTokensForLogicalAssetTicker(lat: LogicalAssetTicker): (NativeCurrency | Token)[] {
  const r: (NativeCurrency | Token)[] = [];
  logicalAssetsToSupportedNativeCurrencyAndTokenTickers[lat].forEach(tt => {
    const maybeTokens = tokensByTicker[tt];
    if (maybeTokens !== undefined) r.push(...maybeTokens);
  });
  return r;
}

// getDecimalsToRenderForTokenTicker returns the canonical number of
// digits after the decimal point to render for a native currency or
// token as identified by its passed ticker.
export function getDecimalsToRenderForTokenTicker(nativeCurrencyOrTokenTicker: Uppercase<string>): number {
  const lat: LogicalAssetTicker | undefined = getLogicalAssetTickerForTokenOrNativeCurrencyTicker(nativeCurrencyOrTokenTicker);
  if (lat !== undefined) return getDecimalsToRenderForLogicalAssetTicker(lat);
  else return 2;
}

// getDefaultTruncateTrailingZeroesForTokenTicker returns the default
// value for whether or not values of the token for the passed ticker
// should have trailing zeroes truncated. See FormatFloatOpts.
export function getDefaultTruncateTrailingZeroesForTokenTicker(nativeCurrencyOrTokenTicker: Uppercase<string>): boolean {
  const lat: LogicalAssetTicker | undefined = getLogicalAssetTickerForTokenOrNativeCurrencyTicker(nativeCurrencyOrTokenTicker);
  if (lat !== undefined) return getDefaultTruncateTrailingZeroesForLogicalAssetTicker(lat);
  else return false;
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
    DONE given a token/native currency ticker, get the logical asset ticker which it supports, if any
*/
