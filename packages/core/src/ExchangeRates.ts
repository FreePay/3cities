import { type DeepWritable } from "./Writable";
import { hasOwnProperty } from "./hasOwnProperty";
import { type LogicalAssetTicker, parseLogicalAssetAmount } from "./logicalAssets";
import { toUppercase } from "./toUppercase";

export type ExchangeRates = Readonly<{
  [denominatorTicker: Uppercase<string>]: Readonly<{
    [numeratorTicker: Uppercase<string>]: number;
  }>;
}>;

// areExchangeRatesEqual returns true iff the passed ExchangeRates are
// identical. WARNING areExchangeRatesEqual must be manually updated if
// the struture of ExchangeRates changes --> an alternative to
// areExchangeRatesEqual is to adopt the fast-deep-equal library, see
// other note (search for "fast-deep-equal")
export function areExchangeRatesEqual(a: ExchangeRates | undefined, b: ExchangeRates | undefined): boolean {
  if (a === undefined && b === undefined) return true;
  else if (a === undefined || b === undefined) return false;
  else {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    else {
      let isEqual = true;
      for (const keyARaw of keysA) {
        const keyA = toUppercase(keyARaw);
        if (!hasOwnProperty(b, keyA)) {
          isEqual = false;
          break;
        } else {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- here we know it exists
          const innerKeysA = Object.keys(a[keyA]!);
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- here we know it exists
          const innerKeysB = Object.keys(b[keyA]!);
          if (innerKeysA.length !== innerKeysB.length) {
            isEqual = false;
            break;
          } else for (const innerKeyRaw of innerKeysA) {
            const innerKey = toUppercase(innerKeyRaw);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- here we know it exists
            if (!hasOwnProperty(b[keyA], innerKey) || a[keyA]![innerKey] !== b[keyA]![innerKey]) {
              isEqual = false;
              break;
            }
          }
        }
      }
      return isEqual;
    }
  }
}

// mergeExchangeRates merges the passed exchange rates, prioritizing
// rates in `right` over `left`.
export function mergeExchangeRates(left: ExchangeRates | undefined, right: ExchangeRates | undefined): ExchangeRates | undefined {
  if (left === undefined && right === undefined) return undefined;
  else return mergeMutable(mergeMutable({}, left), right);

  function mergeMutable(target: DeepWritable<ExchangeRates>, source: ExchangeRates | undefined): ExchangeRates {
    if (source !== undefined) for (const [fromRaw, toRates] of Object.entries(source)) {
      const from = toUppercase(fromRaw);
      if (target[from] === undefined) target[from] = {};
      for (const [toRaw, rate] of Object.entries(toRates)) {
        const to = toUppercase(toRaw);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- here we know it exists
        target[from]![to] = rate;
      }
    }
    return target;
  }
}

// TODO consider implementing something like a graph algorithm to find paths between any from/to. Ie. case 1. passed from/to occurs explicitly in exchange rates; case 2. passed to/from occurs (reciprocal); case 3. discover a route --> since exchange rates are immutable, these routes can be baked in at creation time, for example: 1. getExchangeRates -> 2. update exchange rates if !areExchangeRatesEqual -> 3. prior to updating, run a graph algorithm on the core rates to generate an expanded rates that adds computed rates for all paths. Example: core rates have ETH/USD and rETH/ETH, then the expanded rates would automatically generate rETH/USD, such convert doesn't have to run any graph algorithm, the full set of rates is now baked in --> or something simpler: TODO consider updating convert() to have a hardcoded list of exchange rate routes it'll try, eg. if somebody requests from: EUR, to: ETH it should use USD/EUR and ETH/USD automatically, so we don't have to fetch rates for each pair

// convert uses the passed exchange rates to convert the passed
// fromAmount from being denominated in the asset identified by the
// passed fromTicker to being denominated in the passed toTicker.
// WARNING the passed fromAmount must be an amount denominated in the
// passed fromTicker. The passed fromTicker and toTicker may be a
// logical asset ticker, native currency ticker, or token ticker.
// WARNING convert only converts based on exchange rates and does not
// handle decimals differing between from/to assets. Example: convert
// can convert between USDC and ETH, but the resulting value still needs
// to have its decimals scaled from USDC's 6 to ETH's 18.
export function convert(params: { er: ExchangeRates | undefined; fromTicker: Uppercase<string>; toTicker: Uppercase<string>; fromAmount: bigint; }): undefined | bigint {
  const { er, fromTicker: from, toTicker: to, fromAmount } = params;
  if (er === undefined) return undefined;
  else if (from === to) return fromAmount;
  else {
    const rate: undefined | number = (() => {
      const directRate = er[from]?.[to]; // eg. if passed from is ETH and passed to is USD, then we want to multiply ETH * USD/ETH = USD, and so from is the denominator in our rate
      if (directRate !== undefined) return directRate;
      else {
        // if the rate X/Y isn't available, we'll automatically derive it iff Y/X is available
        const reciprocalRate = er[to]?.[from];
        if (reciprocalRate !== undefined) return 1 / reciprocalRate;
        else return undefined;
      }
    })();
    if (rate === undefined) return undefined;
    else {
      // here we apply the rate to execute the conversion, using bigints to avoid loss of precision. But, we want to ensure that any result decimals that may be truncated are instead rounded:
      const rateStr = rate.toString();
      const decimalIndex: bigint = BigInt(rateStr.indexOf('.'));
      const scale: bigint = decimalIndex > -1n ? BigInt(BigInt(rateStr.length) - decimalIndex - 1n) : 0n;
      const rateBigInt: bigint = BigInt(rateStr.replace('.', ''));
      const resultMayNeedScaling: bigint = fromAmount * rateBigInt;
      if (scale > 0) {
        const halfScale: bigint = 10n ** (scale - 1n); // "The technique of adding half of the scale before dividing is a common way to achieve rounding in integer division. It's based on the idea that adding half of the divisor (the scale in this case) to the dividend will push the quotient over the threshold to the next integer if the remainder of the division is more than half of the divisor."
        const resultScaled: bigint = (resultMayNeedScaling + halfScale) / (10n ** scale);
        return resultScaled;
      } else return resultMayNeedScaling;
    }
  }
}

const oneUnitOfLogicalAsset: bigint = parseLogicalAssetAmount('1');

// unitRate computes the exchange rate for the passed pair. This can be
// useful if the pair is not included directly in ExchangeRates. TODO
// consider removing this function and querying all rates directly from
// ExchangeRates --> see plan above to bake all possible rates into
// ExchangeRates at construction time
export function unitRate(params: { er: ExchangeRates; numerator: LogicalAssetTicker; denominator: LogicalAssetTicker; }): undefined | bigint {
  return convert({ er: params.er, fromTicker: params.denominator, toTicker: params.numerator, fromAmount: oneUnitOfLogicalAsset });
}

// *************************************************
// BEGIN -- tests for convert
// *************************************************

// const mockExchangeRates: ExchangeRates = {
//   'USD': {
//     'ETH': 2500,         // No decimals
//     'EUR': 1.12,         // Two decimals
//   },
//   'ETH': {
//     'USD': 0.0004,       // Many decimals
//     'EUR': 2000,         // No decimals, many digits
//   },
//   'EUR': {
//     'USD': 0.89,         // Two decimals
//     'ETH': 0.0005,       // Many decimals
//   },
// };

// // Test harness
// const runTest = (testName: string, expected: undefined | bigint, actual: undefined | bigint) => {
//   const passed: boolean = expected === actual;
//   console.log(`Test '${testName}': ${passed ? 'Passed' : 'Failed'} - Expected: ${expected}, Actual: ${actual}`);
// };

// // Corrected test cases
// runTest('ETH to USD, no decimals', BigInt(0.0004 * Math.pow(10, 18)), convert({ er: mockExchangeRates, fromTicker: 'ETH', toTicker: 'USD', fromAmount: oneUnitOfLogicalAsset }));
// runTest('USD to ETH, many decimals', oneUnitOfLogicalAsset * BigInt(10000) / BigInt(4), convert({ er: mockExchangeRates, fromTicker: 'USD', toTicker: 'ETH', fromAmount: oneUnitOfLogicalAsset }));
// runTest('EUR to USD, two decimals', BigInt(89) * oneUnitOfLogicalAsset / BigInt(100), convert({ er: mockExchangeRates, fromTicker: 'EUR', toTicker: 'USD', fromAmount: oneUnitOfLogicalAsset }));
// runTest('USD to EUR, two decimals', BigInt(112) * oneUnitOfLogicalAsset / BigInt(100), convert({ er: mockExchangeRates, fromTicker: 'USD', toTicker: 'EUR', fromAmount: oneUnitOfLogicalAsset }));
// runTest('Same asset conversion', oneUnitOfLogicalAsset, convert({ er: mockExchangeRates, fromTicker: 'USD', toTicker: 'USD', fromAmount: oneUnitOfLogicalAsset }));
// runTest('ETH to EUR, no decimals, many digits', BigInt(2000) * oneUnitOfLogicalAsset, convert({ er: mockExchangeRates, fromTicker: 'ETH', toTicker: 'EUR', fromAmount: oneUnitOfLogicalAsset }));
// runTest('EUR to ETH, many decimals, one pre-decimal', BigInt(500) * oneUnitOfLogicalAsset / BigInt(10 ** 6), convert({ er: mockExchangeRates, fromTicker: 'EUR', toTicker: 'ETH', fromAmount: oneUnitOfLogicalAsset }));
// runTest('Unavailable rate', undefined, convert({ er: mockExchangeRates, fromTicker: 'USD', toTicker: 'CAD', fromAmount: oneUnitOfLogicalAsset }));
// runTest('Zero amount conversion', BigInt(0), convert({ er: mockExchangeRates, fromTicker: 'ETH', toTicker: 'USD', fromAmount: BigInt(0) }));

// *************************************************
// END -- tests for convert
// *************************************************
