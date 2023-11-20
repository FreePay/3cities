import React from 'react';
import { ExchangeRates } from './ExchangeRates';
import { Observer, makeObservableValue } from './observer';

// ExchangeRatesContext provides an observer for the global exchange
// rates, which is automatically kept up-to-date with the latest
// exchange rates for certain pairs. WARNING this context must only be
// provided by ExchangeRatesProvider and used by useExchangeRates, and
// not directly consumed by anything else.
export const ExchangeRatesContext = React.createContext<Observer<ExchangeRates | undefined>>(makeObservableValue<ExchangeRates | undefined>(undefined).observer);
