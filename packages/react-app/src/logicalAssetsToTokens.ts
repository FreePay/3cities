import { NativeCurrency, Token } from "./Token";
import { logicalAssetsByTicker, LogicalAssetTicker } from "./logicalAssets";
import { tokensByTicker } from "./tokens";

export function getNativeCurrenciesAndTokensForLogicalAssetTicker(lat: LogicalAssetTicker): (NativeCurrency | Token)[] {
  const la = logicalAssetsByTicker[lat];
  const r: (NativeCurrency | Token)[] = [];
  for (const t of Object.keys(la.supportedTokenTickers)) {
    const maybeTokens = tokensByTicker[t];
    if (maybeTokens !== undefined) r.push(...maybeTokens);
  }
  // console.log("getNativeCurrenciesAndTokensForLogicalAssetTicker lat=", lat, "r=", r);
  return r;
}
