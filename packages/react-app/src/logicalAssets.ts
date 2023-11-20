import { BigNumber } from "@ethersproject/bignumber";
import { parseUnits } from "@ethersproject/units";
import { LogicalAssetTicker as LogicalAssetTickerPb } from "./gen/threecities/v1/v1_pb";

export type LogicalAssetTicker = Exclude<keyof typeof LogicalAssetTickerPb, 'UNSPECIFIED'>; // here, we use the protobuf definition of logical asset tickers to be our single authoritative definition, and derive our app-layer logical asset ticker types from protobuf definitions in a typesafe manner.

export const allLogicalAssetTickers: Readonly<LogicalAssetTicker[]> = (() => { // the set of all logical asset tickers we support
  const o: { [lat in LogicalAssetTicker]: lat } = { // this literal is a "self-mapped" mapped type that enforces that the value for a given key must be the same as the key, while also enforcing that the set of keys is the complete set of LogicalAssetTickers. Combined with Object.values, it gives us a typesafe way to generate a complete list of logical asset tickers. If we instead tried to use Object.keys, it wouldn't be typesafe because Object.keys returns string[] and loses the type information, but Object.values retains the type information.
    ETH: 'ETH',
    USD: 'USD',
    CAD: 'CAD',
    EUR: 'EUR',
  };
  return Object.freeze(Object.values(o));
})();

type PrefixXorSuffix = Readonly<{
  prefix: string,
  suffix?: never,
} | {
  prefix?: never,
  suffix: string,
}>

export type LogicalAsset = Readonly<{
  ticker: keyof typeof logicalAssetsByTicker, // ticker for this logical asset
  name: string, // human-readable name for this logical asset
  shortDescription: string, // human-readable short description for this logical asset, suitable to be displayed as a stand-alone explanation of the asset. Eg. on a button label
  longDescription: string, // human-readable long description for this logical asset, suitable to be displayed as a stand-alone explanation of the asset. Eg. as a FAQ or glossary entry
  symbol: PrefixXorSuffix, // human-readable symbol (ie. short, succinct) prefix and suffix for this logical asset
  canonicalFormat: PrefixXorSuffix, // human-readable canonical format (ie. ordinary, conversational) prefix and suffix for this logical asset
  verboseFormat: PrefixXorSuffix,  // human-readable verbose format (ie. unambiguous, formal) prefix and suffix for this logical asset
}>;

export const logicalAssetsByTicker: Readonly<{ [key in LogicalAssetTicker]: LogicalAsset }> = {
  'ETH': {
    ticker: 'ETH',
    name: 'Ether',
    shortDescription: 'Ethereum ETH',
    longDescription: 'Ether, the native currency of the Ethereum blockchain and many of its Layer-2 blockchains',
    symbol: { prefix: 'Ξ' },
    canonicalFormat: { suffix: ' ETH' },
    verboseFormat: { suffix: ' ETH' },
  },
  'USD': {
    ticker: 'USD',
    name: 'US Dollar',
    shortDescription: 'US Dollar $',
    longDescription: 'United States Dollar',
    symbol: { prefix: '$' },
    canonicalFormat: { prefix: '$' },
    verboseFormat: { prefix: 'US$' },
  },
  'EUR': {
    ticker: 'EUR',
    name: 'Euro',
    shortDescription: 'Euro €',
    longDescription: 'European Union Euro',
    symbol: { suffix: '€' },
    canonicalFormat: { suffix: '€' },
    verboseFormat: { suffix: '€' },
  },
  'CAD': {
    ticker: 'CAD',
    name: 'Canadian Dollar',
    shortDescription: 'Canadian Dollar $',
    longDescription: 'Canadian Dollar',
    symbol: { prefix: '$' },
    canonicalFormat: { prefix: '$' },
    verboseFormat: { prefix: 'CA$' },
  },
};

export const logicalAssets: Readonly<LogicalAsset[]> = Object.values(logicalAssetsByTicker); // the set of all logical assets we support

export const logicalAssetDecimals = 18; // all logical assets have 18 decimals, ie. we model their amounts as if they were tokens with 18 decimals. For example, a logical asset amount for $5.75 is `5.75 * 10^18`

// parseLogicalAssetAmount takes a string representation of a float
// amount, such as "5.75" and returns the full-precision logical asset
// integer amount based on the number of token decimals used for logical
// assets.
export function parseLogicalAssetAmount(amount: string): BigNumber {
  return parseUnits(amount, logicalAssetDecimals);
}

const ten: BigNumber = BigNumber.from(10);

// convertLogicalAssetUnits converts the passed logicalAssetAmount
// (which is assumed to have the full-precision logicalAssetDecimals
// decimal places because it was constructed with
// parseLogicalAssetAmount) into the passed newDecimals count of decimal
// places. For example, `convertLogicalAssetUnits(myLogicalAssetAmount,
// USDC.decimals)` converts the passed logical asset amount into an
// amount with USDC's decimals. WARNING however, the returned amount may
// still need exchange rate conversions applied to be sensical.
export function convertLogicalAssetUnits(logicalAssetAmount: BigNumber, newDecimals: number): BigNumber {
  const decimalDiff = logicalAssetDecimals - newDecimals;
  if (decimalDiff === 0) return logicalAssetAmount; // no conversion needed if the decimals are the same
  else if (decimalDiff > 0) {
    const scale = ten.pow(decimalDiff); // scale for narrowing the precision
    const halfScale = scale.div(2); // half of the scale for rounding. "The technique of adding half of the scale before dividing is a common way to achieve rounding in integer division. It's based on the idea that adding half of the divisor (the scale in this case) to the dividend will push the quotient over the threshold to the next integer if the remainder of the division is more than half of the divisor."
    return logicalAssetAmount.add(halfScale).div(scale); // add half of the scale for rounding and then divide by the scale to narrow the precision
  } else return logicalAssetAmount.mul(ten.pow(-decimalDiff));
}

// getDecimalsToRenderForTLogicalAsseticker returns the canonical number
// of digits after the decimal point to render for a logical asset based
// on its passed ticker.
export function getDecimalsToRenderForLogicalAssetTicker(lat: LogicalAssetTicker): number {
  switch (lat) {
    case 'ETH': return 5; // with 5 decimals, the smallest renderable value is 0.00001 ETH which is about $0.02 with USD/ETH at $2k
    case 'USD': return 2;
    case 'CAD': return 2;
    case 'EUR': return 2;
  }
}

// getDefaultTruncateTrailingZeroesForLogicalAssetTicker returns the
// default value for whether or not logical asset values should have
// trailing zeroes truncated. See FormatFloatOpts.
export function getDefaultTruncateTrailingZeroesForLogicalAssetTicker(lat: LogicalAssetTicker): boolean {
  switch (lat) {
    case 'ETH': return true; // by default, we truncate trailing zeroes such that values like "0.0500" ETH are rendered as "0.05"
    // by default, we don't truncate trailing zeroes on allfiat currencies, so that "$1.20" stays rendered as "$1.20" instead of "$1.2"
    case 'USD': return false;
    case 'CAD': return false;
    case 'EUR': return false;
  }
}

// addSymbolToLogicalAssetValue takes the passed human-readable logical
// asset value and applies its logical asset symbol to the value.
// Example input: "5.35", example output: "$5.35".
export function addSymbolToLogicalAssetValue(lat: LogicalAssetTicker, value: string): string {
  const la = logicalAssetsByTicker[lat];
  return `${la.symbol.prefix ?? ''}${value}${la.symbol.suffix ?? ''}`;
}

// addCanonicalFormatToLogicalAssetValue takes the passed human-readable
// logical asset value and applies its canonical format to the value.
// Example input: "5.35", example output: "5.35 ETH".
export function addCanonicalFormatToLogicalAssetValue(lat: LogicalAssetTicker, value: string): string {
  const la = logicalAssetsByTicker[lat];
  return `${la.canonicalFormat.prefix ?? ''}${value}${la.canonicalFormat.suffix ?? ''}`;
}

// addVerboseFormatToLogicalAssetValue takes the passed human-readable
// logical asset value and applies its canonical format to the value.
// Example input: "5.35", example output: "5.35 ETH".
export function addVerboseFormatToLogicalAssetValue(lat: LogicalAssetTicker, value: string): string {
  const la = logicalAssetsByTicker[lat];
  return `${la.verboseFormat.prefix ?? ''}${value}${la.verboseFormat.suffix ?? ''}`;
}
