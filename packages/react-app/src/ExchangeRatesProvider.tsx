import { BigNumber } from "@ethersproject/bignumber";
import React, { useEffect, useState } from 'react';
import { useImmer } from 'use-immer';
import { goerli, mainnet } from 'wagmi';
import { readContracts } from 'wagmi/actions';
import { ExchangeRates, areExchangeRatesEqual } from './ExchangeRates';
import { ExchangeRatesContext } from './ExchangeRatesContext';
import { DeepWritable } from './Writable';
import { isProduction } from './isProduction';
import { ObservableValue, ObservableValueUpdater, ObservableValueUpdaterWithCurrentValue, Observer, makeObservableValue } from './observer';
import { toUppercase } from './toUppercase';
import useDebounce from './useDebounce';
import { useIsPageVisibleOrRecentlyVisible } from './useIsPageVisibleOrRecentlyVisible';

type ExchangeRatesProviderProps = {
  children?: React.ReactNode;
}

// ExchangeRatesProvider is a global provider to provide data for
// useExchangeRates. By using observer indirection,
// ExchangeRatesProvider prevents both itself and the client entrypoint
// useExchangeRates from rerendering unnecessarily, and only
// useEchangeRates rerenders when data updates.
export const ExchangeRatesProvider: React.FC<ExchangeRatesProviderProps> = ({ children }) => {
  const [ov] = useState(() => makeObservableValue<ExchangeRates | undefined>(undefined));
  return <>
    <ExchangeRatesContext.Provider value={ov.observer}>
      {children}
    </ExchangeRatesContext.Provider>
    <ExchangeRatesUpdater ovu={ov} />
  </>
};

// ExchangeRate represents a snapshot of a single exchange rate for a
// single pair at a point in time.
type ExchangeRate = {
  denominatorTicker: Uppercase<string>;
  numeratorTicker: Uppercase<string>;
  exchangeRate: number;
  timestamp: number; // time at which this exchange rate was snapshotted in milliseconds since epoch
  source: string; // source for this exchange rate snapshot, eg. "Kraken"
}

const minIndependentExchangeRatesToBeValid: Readonly<{ [denominatorTicker: Uppercase<string>]: Readonly<{ [numeratorTicker: Uppercase<string>]: number; }>; }> = { // static config of the minimum number of independent rate sources for a pair that must be available in order for the summarized rate to be considered valid
  ETH: {
    USD: 3,
  },
};

const defaultMinIndependentExchangeRatesToBeValid = 2; // default value for minIndependentExchangeRatesToBeValid if a pair does not appear in its static config

// ExchangeRateFetcher is fetches a single exchange rate value. The
// value is expected to be denominated in the ExchangeRateFetcher's
// pair. The source describes from where the rate value was fetched.
type ExchangeRateFetcher = Pick<ExchangeRate, 'denominatorTicker' | 'numeratorTicker' | 'source'> & {
  fetchExchangeRate: () => Promise<number>; // fetch (or re-fetch) the exchange rate value
  refetchIntervalMilliseconds: number; // suggested refetch period in milliseconds
}

const maxExchangeRateAgeMillis: number = 65_000; // the maximum age of an ExchangeRate in milliseconds after which it is considered stale and excluded from computing ExchangeRates. In future, this could vary per pair, eg. USD/ETH could have a shorter lifespan than USD/EUR

const defaultRefetchIntervalMilliseconds: number = 29_000; // the default refetch interval for an ExchangeRateFetcher if it doesn't specify one

const exchangeRatesToFetch: Array<ExchangeRateFetcher> = [
  // Mock fetchers:
  // { denominatorTicker: 'ETH', numeratorTicker: 'USD', source: 'Coinbase Mock', fetchExchangeRate: () => Promise.resolve(2000 + Math.random() * 20), refetchIntervalMilliseconds: defaultRefetchIntervalMilliseconds },
  // { denominatorTicker: 'ETH', numeratorTicker: 'USD', source: 'Kraken Mock', fetchExchangeRate: () => Promise.resolve(2004 + Math.random() * 20), refetchIntervalMilliseconds: defaultRefetchIntervalMilliseconds },
  // { denominatorTicker: 'ETH', numeratorTicker: 'USD', source: 'Binance Mock', fetchExchangeRate: () => Promise.resolve(2008 + Math.random() * 20), refetchIntervalMilliseconds: defaultRefetchIntervalMilliseconds },
  {
    denominatorTicker: 'ETH',
    numeratorTicker: 'USD',
    source: 'Coinbase',
    fetchExchangeRate: async (): Promise<number> => {
      const url = 'https://api.coinbase.com/v2/prices/ETH-USD/spot';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`response not ok: ${response.statusText}`);
      }
      const data = await response.json();
      if (!data.data || !data.data.amount) throw new Error('response invalid');
      else return parseFloat(data.data.amount);
    },
    refetchIntervalMilliseconds: defaultRefetchIntervalMilliseconds,
  },
  {
    denominatorTicker: 'ETH', numeratorTicker: 'USD', source: 'Coingecko', fetchExchangeRate: async (): Promise<number> => {
      const url = new URL('https://api.coingecko.com/api/v3/simple/price');
      url.searchParams.append('ids', 'ethereum');
      url.searchParams.append('vs_currencies', 'usd');
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`response not ok ${url.toString()}: ${response.statusText}`);
      const data = await response.json();
      if (!data.ethereum.usd) throw new Error('response invalid');
      else return data.ethereum.usd;
    }, refetchIntervalMilliseconds: 60_500, // Coingecko seems to aggressively rate limit so we'll fetch only once per minute
  },
  {
    denominatorTicker: 'ETH',
    numeratorTicker: 'USD',
    source: 'Kraken',
    fetchExchangeRate: async (): Promise<number> => {
      const url = 'https://api.kraken.com/0/public/Ticker?pair=ETHUSD';
      const response = await fetch(url);
      if (!response.ok) throw new Error(`response not ok: ${response.statusText}`);
      const data = await response.json();
      if (!data.result || !data.result.XETHZUSD) throw new Error('response invalid');
      else return parseFloat(data.result.XETHZUSD.c[0]); // Assuming 'c' array's first element is the last trade price
    },
    refetchIntervalMilliseconds: defaultRefetchIntervalMilliseconds,
  },
  {
    denominatorTicker: 'ETH',
    numeratorTicker: 'USD',
    source: 'Binance USDC', // Binance quotes ETH price against USDT and USDC. Currently, we fetch only USDC
    fetchExchangeRate: async (): Promise<number> => {
      const symbol = 'ETHUSDC';
      const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`response not ok: ${response.statusText}`);
      const data = await response.json();
      if (!data.price) throw new Error('response invalid');
      else return parseFloat(data.price);
    },
    refetchIntervalMilliseconds: defaultRefetchIntervalMilliseconds,
  },
  ...(!isProduction ? [] : [{ // only fetch Chainlink USD/ETH on mainnet because I can't find the right contract on testnet. TODO what's the testnet oracle contract we can use to run this in testnet, too?
    denominatorTicker: 'ETH',
    numeratorTicker: 'USD',
    source: 'Chainlink',
    fetchExchangeRate: async (): Promise<number> => {
      const chainlinkUSDETHOracleContract = {
        chainId: isProduction ? mainnet.id : goerli.id,
        address: ('0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419' satisfies `0x${string}`) as `0x${string}`,
        abi: [{ "inputs": [], "name": "decimals", "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "latestRoundData", "outputs": [{ "internalType": "uint80", "name": "roundId", "type": "uint80" }, { "internalType": "int256", "name": "answer", "type": "int256" }, { "internalType": "uint256", "name": "startedAt", "type": "uint256" }, { "internalType": "uint256", "name": "updatedAt", "type": "uint256" }, { "internalType": "uint80", "name": "answeredInRound", "type": "uint80" }], "stateMutability": "view", "type": "function" }], // only the subset of the ABI we use here. TODO use https://abitype.dev/ for strongly typed abis and result types
      };
      const [decimals, latestRoundData] = await readContracts({
        allowFailure: false,
        contracts: [
          {
            ...chainlinkUSDETHOracleContract,
            functionName: 'decimals',
            args: [],
          },
          {
            ...chainlinkUSDETHOracleContract,
            functionName: 'latestRoundData',
          },
        ],
      });
      if (typeof decimals === 'number' && Array.isArray(latestRoundData)) {
        const price = latestRoundData[1];
        if (BigNumber.isBigNumber(price)) {
          const scaleToCents = BigNumber.from(Math.pow(10, decimals - 2));
          const halfScale = scaleToCents.div(2); // "The technique of adding half of the scale before dividing is a common way to achieve rounding in integer division. It's based on the idea that adding half of the divisor (the scale in this case) to the dividend will push the quotient over the threshold to the next integer if the remainder of the division is more than half of the divisor."
          const roundedPriceInCents = price.add(halfScale).div(scaleToCents);
          const priceRoundedToNearestCentInDollars = roundedPriceInCents.toNumber() / 100;
          return priceRoundedToNearestCentInDollars;
        } else throw new Error(`invalid price: ${price}`);
      } else throw new Error(`invalid response: ${JSON.stringify({ decimals, latestRoundData })}`);
    },
    refetchIntervalMilliseconds: defaultRefetchIntervalMilliseconds,
  } satisfies ExchangeRateFetcher]),
];

type ExchangeRatesUpdaterProps = {
  ovu: ObservableValueUpdaterWithCurrentValue<ExchangeRates | undefined>;
}

const ExchangeRatesUpdater: React.FC<ExchangeRatesUpdaterProps> = ({ ovu }) => {
  const [exchangeRateUpdaterOv] = useState<ObservableValue<ExchangeRate | undefined>>(() => makeObservableValue<ExchangeRate | undefined>(undefined)); // a singleton pipe to ingress the latest ExchangeRate snapshots for all exchange rate fetchers and then egress these ExchangeRate snapshots into ExchangeRatesUpdaterInner to be assembled into a final ExchangeRates
  return <>
    <ExchangeRatesUpdaterInner exchangeRatesObservableValueUpdater={ovu} exchangeRateUpdatersObserver={exchangeRateUpdaterOv.observer} />
    {exchangeRatesToFetch.map((erf, i) => <OneExchangeRateUpdater key={i} erf={erf} ovu={exchangeRateUpdaterOv} />)}
  </>;
};

type ExchangeRatesUpdaterInnerProps = {
  exchangeRatesObservableValueUpdater: ObservableValueUpdaterWithCurrentValue<ExchangeRates | undefined>; // the egress observable value used to push the latest global ExchangeRates to downstream
  exchangeRateUpdatersObserver: Observer<ExchangeRate | undefined>; // the ingress observer that receives a stream of heterenous ExchangeRate snapshots from all exchangeRatesToFetch
}

const ExchangeRatesUpdaterInner: React.FC<ExchangeRatesUpdaterInnerProps> = ({ exchangeRatesObservableValueUpdater, exchangeRateUpdatersObserver }) => {
  const [latestExchangeRates, setLatestExchangeRates] = useImmer<{ [denominatorTicker: Uppercase<string>]: { [numeratorTicker: Uppercase<string>]: { [source: string]: ExchangeRate; }; }; }>({}); // index of latest individual exchange rates per pair and source. Invariant `latestExchangeRate[d][n][s].denominatorTicker/numeratorTicker/source ===  d/n/s

  useEffect(() => {
    const onNewExchangeRate = (newRate: ExchangeRate | undefined) => {
      if (newRate) setLatestExchangeRates((draft) => {
        const { denominatorTicker, numeratorTicker, source } = newRate;
        if (!draft[denominatorTicker]) draft[denominatorTicker] = {};
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- here we know it exists
        if (!draft[denominatorTicker]![numeratorTicker]) draft[denominatorTicker]![numeratorTicker] = {};
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- here we know it exists
        draft[denominatorTicker]![numeratorTicker]![source] = newRate;
      });
    };
    return exchangeRateUpdatersObserver.subscribe(onNewExchangeRate).unsubscribe;
  }, [exchangeRateUpdatersObserver, setLatestExchangeRates]);

  const [newExchangeRates, setNewExchangeRates] = useState<ExchangeRates | undefined>(undefined);

  const maxDebounceWaitMillis = 150; // see note on flushDebouncedExchangeRates. WARNING if we make maxDebounceWaitMillis too large, then pay links with only payment methods that use exchange rates will be more likely to have UI jank flash "no payment methods available" after the initial payment method loading grace period elapses but exchange rates haven't yet flushed
  const [lastFlushTime, setLastFlushTime] = useState<number>(Date.now());
  const isDuringFlushGracePeriod: boolean = Date.now() - lastFlushTime <= maxDebounceWaitMillis; // when calculated debounced exchange rates, we allow a flush grace period during which the debounce runs normally
  const flushDebouncedExchangeRates: boolean = !isDuringFlushGracePeriod; Date.now() - lastFlushTime > maxDebounceWaitMillis; // force flush the debounced exchange rates if the time since last debounce exceeds maxDebounceWaitMillis. This protects against a steady stream of new exchange rates causing the debounce to never flush, which would make downstream ExchangeRates stale

  useEffect(() => {
    const updateExchangeRates = () => {
      const er: ExchangeRates = getExchangeRates({ minIndepToBeValid: minIndependentExchangeRatesToBeValid, defaultMinIndepToBeValid: defaultMinIndependentExchangeRatesToBeValid, latestExchangeRates, maxAgeMillis: maxExchangeRateAgeMillis, timeNowMillisSinceEpoch: Date.now() });
      if (newExchangeRates === undefined || !areExchangeRatesEqual(newExchangeRates, er)) {
        setNewExchangeRates(er);
        if (!isDuringFlushGracePeriod) setLastFlushTime(Date.now()); // if we're not in the flush grace period, then newExchangeRates hasn't been updated since the last flush grace period elapsed, so we'll begin a new grace period. This allows a burst of newExchangeRates updates to arrive during the grace period and then when the grace period elapses, trigger only a single ExchangeRates update downstream
      }
    }
    updateExchangeRates(); // here we must update rates immediately when dependencies change, otherwise when eg. latestExchangeRates changes, we wouldn't call updateExchangeRates until the interval first fires
    const interval = setInterval(updateExchangeRates, 2_000); // update exchangeRates rapidly, even if no new ExchangeRate arrive from exchangeRateUpdatersObserver, to eagerly drop stale rates
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- here we only want to rerun this effect when latestExchangeRates changes and not when newExchangeRates changes as we're setting it in this effect
  }, [latestExchangeRates, setNewExchangeRates, setLastFlushTime, isDuringFlushGracePeriod]);

  const debouncedExchangeRates: ExchangeRates | undefined = useDebounce(newExchangeRates, maxDebounceWaitMillis, flushDebouncedExchangeRates); // we debounce newExchangeRates because typically, the stream of ExchangeRate updates arrives in bursts as the upstream updater timers are initialized at the same time and on the same period. This prevents downstream from receiving a rapid burst of ExchangeRates and avoids unnecessary rerenders downstream
  // @eslint-no-use-below[newExchangeRates] -- newExchangeRates has been debounced and shouldn't be used again

  useEffect(() => {
    const currentExchangeRates = exchangeRatesObservableValueUpdater.getCurrentValue();
    if (debouncedExchangeRates !== undefined && (currentExchangeRates === undefined || !areExchangeRatesEqual(currentExchangeRates, debouncedExchangeRates))) exchangeRatesObservableValueUpdater.setValueAndNotifyObservers(debouncedExchangeRates);
  }, [debouncedExchangeRates, exchangeRatesObservableValueUpdater]);

  return undefined;
}

type OneExchangeRateUpdaterProps = {
  erf: ExchangeRateFetcher;
  ovu: ObservableValueUpdater<ExchangeRate>;
}

const OneExchangeRateUpdater: React.FC<OneExchangeRateUpdaterProps> = ({ erf, ovu }) => {
  const isPageVisibleOrRecentlyVisible = useIsPageVisibleOrRecentlyVisible();
  useEffect(() => {
    let timerId: NodeJS.Timeout;
    let isMounted = true;
    const fetchAndUpdateRate = async () => {
      const timestamp = Date.now(); // here we set the new ExchangeRate.timestamp at start of fetch. This has the effect of making the rate stale-er if the fetch takes a long time, which errs on the side of being conservative (eg. network anomaly makes a rate fetch take 30 seconds, rate might already be stale)
      const exchangeRate: number | undefined = await erf.fetchExchangeRate().catch(err => {
        console.error(`Failed to fetch exchange rate from ${erf.source} ${erf.numeratorTicker}/${erf.denominatorTicker}:`, err);
        return undefined;
      });
      if (isMounted) {
        if (exchangeRate !== undefined) {
          const er: ExchangeRate = {
            denominatorTicker: erf.denominatorTicker,
            numeratorTicker: erf.numeratorTicker,
            source: erf.source,
            exchangeRate,
            timestamp,
          };
          ovu.setValueAndNotifyObservers(er);
        }
        const nextFetchInterval: number = Math.max(0, erf.refetchIntervalMilliseconds - (Date.now() - timestamp));
        timerId = setTimeout(fetchAndUpdateRate, nextFetchInterval);
      }
    };
    if (isPageVisibleOrRecentlyVisible) fetchAndUpdateRate(); // fetch exchange rates only if the page was recently visible to avoid useless requests when the page is inactive
    return () => {
      clearTimeout(timerId);
      isMounted = false;
    }
  }, [erf, ovu, isPageVisibleOrRecentlyVisible]);

  return undefined;
}

// getExchangeRates takes the latest ExchangeRate snapshot for each
// pair+source and produces an ExchangeRates, while respecting the other
// passed policies.
function getExchangeRates(p: {
  minIndepToBeValid: typeof minIndependentExchangeRatesToBeValid, // quorum policy per pair to determine how many independent rates are required before the medianized rate will be considered valid
  defaultMinIndepToBeValid: number, // default quorum if pair has no specific policy
  latestExchangeRates: { [denominatorTicker: Uppercase<string>]: { [numeratorTicker: Uppercase<string>]: { [source: string]: ExchangeRate; }; }; },
  maxAgeMillis: number, // max age before an ExchangeRate is considered stale and dropped from calculating ExchangeRates
  timeNowMillisSinceEpoch: number, // time now used in max age calculations
}): ExchangeRates {
  const { minIndepToBeValid, defaultMinIndepToBeValid, latestExchangeRates, maxAgeMillis, timeNowMillisSinceEpoch } = p;
  const exchangeRates: DeepWritable<ExchangeRates> = {};
  for (const denominatorTickerRaw of Object.keys(latestExchangeRates)) {
    const denominatorTicker: Uppercase<string> = toUppercase(denominatorTickerRaw); // the specific key type of Uppercase<string> is lost at runtime so here we re-lift it
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- here we know it exists
    for (const numeratorTickerRaw of Object.keys(latestExchangeRates[denominatorTicker]!)) {
      const numeratorTicker: Uppercase<string> = toUppercase(numeratorTickerRaw); // the specific key type of Uppercase<string> is lost at runtime so here we re-lift it

      const allRatesForThisPair: ExchangeRate[] = [];
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- here we know it exists
      for (const source of Object.keys(latestExchangeRates[denominatorTicker]![numeratorTicker]!)) allRatesForThisPair.push(latestExchangeRates[denominatorTicker]![numeratorTicker]![source]!);

      const allNonStaleRatesForThisPair: ExchangeRate[] = allRatesForThisPair.filter(er => !isExchangeRateStale({ maxAgeMillis, timeNowMillisSinceEpoch, er }));

      const minRatesToBeValid: number = minIndepToBeValid[denominatorTicker]?.[numeratorTicker] ?? defaultMinIndepToBeValid;

      if (allNonStaleRatesForThisPair.length >= minRatesToBeValid) {
        const summarizedRate: number | undefined = medianizeRates(allNonStaleRatesForThisPair);
        if (summarizedRate !== undefined) {
          exchangeRates[denominatorTicker] = exchangeRates[denominatorTicker] || {};
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- here we know it exists
          exchangeRates[denominatorTicker]![numeratorTicker] = summarizedRate;
        }
      }
    }
  }

  return exchangeRates;
}

function isExchangeRateStale(p: { maxAgeMillis: number, timeNowMillisSinceEpoch: number, er: ExchangeRate }): boolean {
  return p.timeNowMillisSinceEpoch >= p.er.timestamp + p.maxAgeMillis;
}

// medianizeRates returns the median exchange rate value for the passed
// ExchangeRates.
function medianizeRates(rates: ExchangeRate[]): number | undefined {
  if (rates.length === 0) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- here we know it exists
  else if (rates.length === 1) return rates[0]!.exchangeRate;
  else {
    const sortedRates = rates.map(rate => rate.exchangeRate).sort((a, b) => a - b);
    const mid = Math.floor(sortedRates.length / 2);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- here we know it exists
    if (sortedRates.length % 2 === 0) return (sortedRates[mid - 1]! + sortedRates[mid]!) / 2; // for an even number of rates, the median is the average of the two middle numbers
    else return sortedRates[mid]; // for an odd number of rates, the median is the middle number
  }
}

// *************************************************
// BEGIN -- tests for getExchangeRates
// *************************************************

// // Helper function to create mock ExchangeRate objects
// const createMockExchangeRate = (denominator: string, numerator: string, rate: number, timestampOffset: number): ExchangeRate => {
//   return {
//     denominatorTicker: denominator.toUpperCase() as Uppercase<string>,
//     numeratorTicker: numerator.toUpperCase() as Uppercase<string>,
//     exchangeRate: rate,
//     timestamp: Date.now() + timestampOffset,
//     source: `source-${timestampOffset}`
//   };
// };

// // Test function
// const runGetExchangeRatesTest = (testName: string, expected: ExchangeRates, params: Parameters<typeof getExchangeRates>[0]) => {
//   const actual = getExchangeRates(params);
//   const passed = JSON.stringify(expected) === JSON.stringify(actual);
//   console.log(`Test ${passed ? 'passed' : 'failed'}: ${testName}, expected: ${JSON.stringify(expected)}, actual: ${JSON.stringify(actual)}`);
// };

// // Test with no rates
// runGetExchangeRatesTest('No rates', {}, {
//   minIndepToBeValid: minIndependentExchangeRatesToBeValid,
//   defaultMinIndepToBeValid: 3,
//   latestExchangeRates: {},
//   maxAgeMillis: 1000 * 60 * 60, // 1 hour
//   timeNowMillisSinceEpoch: Date.now()
// });

// // Test with only stale rates
// const staleRates = {
//   'ETH': {
//     'USD': {
//       'source1': createMockExchangeRate('eth', 'usd', 2500, -1000 * 60 * 61), // 61 minutes ago
//       'source2': createMockExchangeRate('eth', 'usd', 2600, -1000 * 60 * 62), // 62 minutes ago
//     }
//   }
// };
// runGetExchangeRatesTest('Only stale rates', {}, {
//   minIndepToBeValid: minIndependentExchangeRatesToBeValid,
//   defaultMinIndepToBeValid: 3,
//   latestExchangeRates: staleRates,
//   maxAgeMillis: 1000 * 60 * 60, // 1 hour
//   timeNowMillisSinceEpoch: Date.now()
// });

// // Test with enough non-stale rates
// const validRates = {
//   'ETH': {
//     'USD': {
//       'source1': createMockExchangeRate('eth', 'usd', 2500, -1000 * 60 * 10), // 10 minutes ago
//       'source2': createMockExchangeRate('eth', 'usd', 2600, -1000 * 60 * 20), // 20 minutes ago
//       'source3': createMockExchangeRate('eth', 'usd', 2400, -1000 * 60 * 30)  // 30 minutes ago
//     }
//   }
// };
// runGetExchangeRatesTest('Enough non-stale rates', { 'ETH': { 'USD': 2500 } }, {
//   minIndepToBeValid: minIndependentExchangeRatesToBeValid,
//   defaultMinIndepToBeValid: 3,
//   latestExchangeRates: validRates,
//   maxAgeMillis: 1000 * 60 * 60, // 1 hour
//   timeNowMillisSinceEpoch: Date.now()
// });

// const ratesMinNonStaleMet = {
//   'ETH': {
//     'USD': {
//       'source1': createMockExchangeRate('eth', 'usd', 2500, -1000 * 60 * 10), // 10 minutes ago
//       'source2': createMockExchangeRate('eth', 'usd', 2600, -1000 * 60 * 20), // 20 minutes ago
//       'source3': createMockExchangeRate('eth', 'usd', 2400, -1000 * 60 * 30), // 30 minutes ago
//       'source4': createMockExchangeRate('eth', 'usd', 2300, -1000 * 60 * 61)  // 61 minutes ago (stale)
//     }
//   }
// };
// runGetExchangeRatesTest('Minimum non-stale rates exactly met', { 'ETH': { 'USD': 2500 } }, {
//   minIndepToBeValid: minIndependentExchangeRatesToBeValid,
//   defaultMinIndepToBeValid: 3,
//   latestExchangeRates: ratesMinNonStaleMet,
//   maxAgeMillis: 1000 * 60 * 60, // 1 hour
//   timeNowMillisSinceEpoch: Date.now()
// });

// const ratesDifferentPair = {
//   'BTC': {
//     'EUR': {
//       'source1': createMockExchangeRate('btc', 'eur', 30000, -1000 * 60 * 15), // 15 minutes ago
//       'source2': createMockExchangeRate('btc', 'eur', 30500, -1000 * 60 * 25), // 25 minutes ago
//       'source3': createMockExchangeRate('btc', 'eur', 31000, -1000 * 60 * 35)  // 35 minutes ago
//     }
//   }
// };
// runGetExchangeRatesTest('Different currency pair', { 'BTC': { 'EUR': 30500 } }, {
//   minIndepToBeValid: minIndependentExchangeRatesToBeValid,
//   defaultMinIndepToBeValid: 2,
//   latestExchangeRates: ratesDifferentPair,
//   maxAgeMillis: 1000 * 60 * 60, // 1 hour
//   timeNowMillisSinceEpoch: Date.now()
// });

// const ratesMixedStaleNonStale = {
//   'ETH': {
//     'CAD': {
//       'source1': createMockExchangeRate('eth', 'cad', 2000, -1000 * 60 * 10), // 10 minutes ago
//       'source2': createMockExchangeRate('eth', 'cad', 2100, -1000 * 60 * 70), // 70 minutes ago (stale)
//       'source3': createMockExchangeRate('eth', 'cad', 2200, -1000 * 60 * 80)  // 80 minutes ago (stale)
//     }
//   }
// };

// runGetExchangeRatesTest('Mixed stale and non-stale rates', {}, {
//   minIndepToBeValid: minIndependentExchangeRatesToBeValid,
//   defaultMinIndepToBeValid: 2,
//   latestExchangeRates: ratesMixedStaleNonStale,
//   maxAgeMillis: 1000 * 60 * 60, // 1 hour
//   timeNowMillisSinceEpoch: Date.now()
// });

// runGetExchangeRatesTest('Mixed stale and non-stale rates #2', { 'ETH': { 'CAD': 2000 } }, {
//   minIndepToBeValid: minIndependentExchangeRatesToBeValid,
//   defaultMinIndepToBeValid: 1,
//   latestExchangeRates: ratesMixedStaleNonStale,
//   maxAgeMillis: 1000 * 60 * 60, // 1 hour
//   timeNowMillisSinceEpoch: Date.now()
// });

// *************************************************
// END -- tests for getExchangeRates
// *************************************************

// *************************************************
// BEGIN -- tests for medianizeRates
// *************************************************

// const runMedianizeRatesTest = (testName: string, expected: number | undefined, rates: ExchangeRate[]) => {
//   const actual = medianizeRates(rates);
//   const passed = expected === actual || (expected === undefined && actual === undefined);
//   console.log(`Test ${passed ? 'passed' : 'failed'}: ${testName}, expected: ${expected}, actual: ${actual}`);
// };

// // Test with no rates
// runMedianizeRatesTest('No rates', undefined, []);

// // Test with one rate
// runMedianizeRatesTest('One rate', 5, [{ denominatorTicker: 'USD', numeratorTicker: 'ETH', exchangeRate: 5, timestamp: Date.now(), source: 'source1' }]);

// // Test with an even number of rates
// runMedianizeRatesTest('Even number of rates', 3.5, [
//   { denominatorTicker: 'USD', numeratorTicker: 'ETH', exchangeRate: 2, timestamp: Date.now(), source: 'source1' },
//   { denominatorTicker: 'USD', numeratorTicker: 'ETH', exchangeRate: 3, timestamp: Date.now(), source: 'source2' },
//   { denominatorTicker: 'USD', numeratorTicker: 'ETH', exchangeRate: 4, timestamp: Date.now(), source: 'source3' },
//   { denominatorTicker: 'USD', numeratorTicker: 'ETH', exchangeRate: 5, timestamp: Date.now(), source: 'source4' }
// ]);

// // Test with an odd number of rates
// runMedianizeRatesTest('Odd number of rates', 3, [
//   { denominatorTicker: 'USD', numeratorTicker: 'ETH', exchangeRate: 2, timestamp: Date.now(), source: 'source1' },
//   { denominatorTicker: 'USD', numeratorTicker: 'ETH', exchangeRate: 3, timestamp: Date.now(), source: 'source2' },
//   { denominatorTicker: 'USD', numeratorTicker: 'ETH', exchangeRate: 5, timestamp: Date.now(), source: 'source3' }
// ]);

// *************************************************
// END -- tests for medianizeRates
// *************************************************
