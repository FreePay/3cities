import { type ExchangeRates, mergeExchangeRates } from "@3cities/core";
import { useContext, useMemo } from "react";
import { ExchangeRatesContext } from "./ExchangeRatesContext";
import { type Observer, useObservedValue } from "./observer";

// useExchangeRates returns the global exchange rates, which are
// automatically kept up-to-date with the latest exchange rates for
// certain pairs. If exchangeRateOverrides is defined, 3cities will
// merge overridden rates with rates provided internally by
// ExchangeRatesContext, prioritizing overrides rates over the internal
// rates. WARNING before passing any overrides, take a look at internal
// exchange rates data and algorithms to anticipate any potentially
// negative interactions.
export function useExchangeRates(exchangeRateOverrides?: ExchangeRates): ExchangeRates | undefined {
  const o: Observer<ExchangeRates | undefined> = useContext(ExchangeRatesContext);
  const er = useObservedValue(o);
  const erWithOverrides: ExchangeRates | undefined = useMemo(() => mergeExchangeRates(er, exchangeRateOverrides), [exchangeRateOverrides, er]); // TODO consider moving exchange rate override merging into ExchangeRatesProvider so that if the overridden rates are equal to the previous rates, no observerable value update is triggered. This prevents unnecessary client rerenders when overrides cause no real rate change --> TODO also consider that perhaps instead of merging exchange rate overrides, any provided overrides should be a flat replacement for internally calculated rates, in which case internal rate fetching may be disabled entirely. Ie. perhaps you can use 3cities' internal rates or provide your own, but no merging occurs - merging behavior could be unexpected.
  return erWithOverrides;
}
