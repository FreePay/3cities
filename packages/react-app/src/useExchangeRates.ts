import { useContext } from "react";
import { ExchangeRates } from "./ExchangeRates";
import { ExchangeRatesContext } from "./ExchangeRatesContext";
import { Observer, useObservedValue } from "./observer";

// useExchangeRates returns the global exchange rates, which are
// automatically kept up-to-date with the latest exchange rates for
// certain pairs.
export function useExchangeRates(): ExchangeRates | undefined {
  const o: Observer<ExchangeRates | undefined> = useContext(ExchangeRatesContext);
  return useObservedValue(o);
}
