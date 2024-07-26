import { convert, convertFromTokenDecimalsToLogicalAssetDecimals, ExchangeRates, getLogicalAssetTickerForTokenOrNativeCurrencyTicker, getTokenKey, type TokenKey } from "@3cities/core";
import { type AddressContext } from "./AddressContext";
import { Strategy } from "./strategies";

// canAfford is a convenience predicate that returns true iff the passed
// address context can afford to transfer the passed full-precision
// amount of the token indicated by the passed token key.
export function canAfford(ac: AddressContext, tk: TokenKey, amount: bigint): boolean {
  const tb = ac.tokenBalances[tk];
  if (tb === undefined) return false;
  else return tb.balance >= amount; // NB here we are able to compare nominal amounts directly without worrying about units because the passed amount is denominated in full-precision units of the same token as the tokenbalance because both are for the passed token key
}

// amountNeededToAfford returns the additional token amount that would
// need to be added to the passed address context's balance for the
// passed token key to afford a payment of the passed amount. WARNING
// the passed amount is assumed to be denominated in full-precision
// units of the token identified by the passed token key. Ie. if
// amountNeededToAfford returns positive, then the passed address
// context can't afford to pay the passed amount and would need the
// returned amount extra to be able to afford it. If
// amountNeededToAfford returns negative, then the address context can
// afford to pay the passed amount and the returned amount is the extra
// balance beyond the minimum needed to afford it.
export function amountNeededToAfford(ac: AddressContext, tk: TokenKey, amount: bigint): bigint {
  const tb = ac.tokenBalances[tk];
  if (tb === undefined) return amount;
  else return amount - tb.balance; // NB here we are able to subtract nominal amounts directly without worrying about units because the passed amount is denominated in full-precision units of the same token as the tokenbalance because both are for the passed token key
}

// partitionStrategiesByAffordability takes the passed strategies and
// returns them partitioned as either affordable xor unaffordable for
// the passed address context. Ie. a strategy is affordable for the
// passed address context if and only if that address has an eligible
// token balance to settle (pay for) the strategy. The returned
// partitions remain in the passed sort order.
export function partitionStrategiesByAffordability(ac: AddressContext, ss: Strategy[]): { affordableStrategies: Strategy[], unaffordableStrategies: Strategy[] } {
  const affordableStrategies: Strategy[] = [];
  const unaffordableStrategies: Strategy[] = [];
  ss.forEach(s => {
    if (canAfford(ac, getTokenKey(s.tokenTransfer.token), s.tokenTransfer.amount)) affordableStrategies.push(s); else unaffordableStrategies.push(s);
  });
  return { affordableStrategies, unaffordableStrategies };
}

// sortStrategiesByLogicalAmountNeededToAfford sorts the passed
// strategies from closest-to-being-affordable to
// furthest-from-being-affordable for the passed address context. The
// passed strategies are sorted in-place, and the array is returned for
// convenience.
export function sortStrategiesByLogicalAmountNeededToAfford(er: ExchangeRates | undefined, ac: AddressContext, ss: Strategy[]): Strategy[] {
  ss.sort((a, b) => {
    const aLat = getLogicalAssetTickerForTokenOrNativeCurrencyTicker(a.tokenTransfer.token.ticker);
    const bLat = getLogicalAssetTickerForTokenOrNativeCurrencyTicker(b.tokenTransfer.token.ticker);
    if (aLat === undefined && bLat === undefined) return 0; // neither token ticker was able to be associated with a logical asset ticker, so we don't modify sort order
    else if (aLat === undefined) return 1; // only `a` failed to associate with a logical asset ticker so we deprioritize it
    else if (bLat === undefined) return -1; // only `b` failed to associate with a logical asset ticker so we deprioritize it
    else {
      const aAmountNeededInLogicalAssetUnitsAndTokenCurrency = convertFromTokenDecimalsToLogicalAssetDecimals(amountNeededToAfford(ac, getTokenKey(a.tokenTransfer.token), a.tokenTransfer.amount), a.tokenTransfer.token.decimals);
      const bAmountNeededInLogicalAssetUnitsAndTokenCurrency = convertFromTokenDecimalsToLogicalAssetDecimals(amountNeededToAfford(ac, getTokenKey(b.tokenTransfer.token), b.tokenTransfer.amount), b.tokenTransfer.token.decimals);

      const aLogicalAmountNeeded: bigint | undefined = (() => {
        if (aLat === 'USD') return aAmountNeededInLogicalAssetUnitsAndTokenCurrency;
        else return convert({ er, fromTicker: aLat, toTicker: 'USD', fromAmount: aAmountNeededInLogicalAssetUnitsAndTokenCurrency });
      })();
      const bLogicalAmountNeeded: bigint | undefined = (() => {
        if (bLat === 'USD') return bAmountNeededInLogicalAssetUnitsAndTokenCurrency;
        else return convert({ er, fromTicker: bLat, toTicker: 'USD', fromAmount: bAmountNeededInLogicalAssetUnitsAndTokenCurrency });
      })();

      if (aLogicalAmountNeeded === undefined && bLogicalAmountNeeded === undefined) return 0; // neither USD-denominated logical asset amount was able to be computed, so we don't modify sort order
      else if (aLogicalAmountNeeded === undefined) return 1; // only `a` failed to compute a USD-denominated logical asset amount, so we deprioritize it
      else if (bLogicalAmountNeeded === undefined) return -1; // only `a` failed to compute a USD-denominated logical asset amount, so we deprioritize it
      else return aLogicalAmountNeeded < bLogicalAmountNeeded ? -1 : (aLogicalAmountNeeded > bLogicalAmountNeeded ? 1 : 0);
    }
  });
  return ss;
}
