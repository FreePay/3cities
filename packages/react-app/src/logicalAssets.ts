import { BigNumber } from "@ethersproject/bignumber";
import { parseUnits } from "@ethersproject/units";

// Design note: we have designed logical assets to have no dependecies (or at least, no dependency on tokens) so that the infrastructure for building and computing data structures over logical assets is separate from and doesn't depend on our supported crypto tokens or chains. Below, we implicitly connect logical assets to crypto tokens by providing a list of supported crypto token tickers for each logical asset. Note that these crypto token tickers don't actually have to exist and be supported by our system; if they don't exist, they'll simply be ignored silently at runtime.

export type LogicalAssetTicker = 'ETH' | 'USD' | 'CAD' | 'EUR';

export type LogicalAsset = {
  ticker: LogicalAssetTicker, // ticker for this logical asset
  name: string, // human-readable name for this logical asset
  supportedTokenTickers: { [tokenTicker: string]: true }, // set of crypto tokens we support where 1.0 unit sof each of these tokens is equivalent to 1.0 units of this logical asset. For example, "1 DAI == 1 USD"
};

export const logicalAssetsByTicker: Readonly<{ [key in LogicalAssetTicker]: LogicalAsset }> = {
  'ETH': {
    ticker: 'ETH',
    name: 'Ether',
    supportedTokenTickers: {
      'ETH': true,
      'WETH': true,
    },
  },
  'USD': {
    ticker: 'USD',
    name: 'US Dollars',
    supportedTokenTickers: {
      'DAI': true,
      'USDC': true,
      'USDT': true,
      'LUSD': true,
    },
  },
  'CAD': {
    ticker: 'CAD',
    name: 'Canadian Dollars',
    supportedTokenTickers: {
      'CADC': true,
    },
  },
  'EUR': {
    ticker: 'EUR',
    name: 'Euros',
    supportedTokenTickers: {
      'EURT': true,
    },
  },
};

export const logicalAssets: Readonly<LogicalAsset[]> = Object.values(logicalAssetsByTicker);

export const logicalAssetDecimals = 6; // all logical assets have 6 decimals, ie. we model their amounts as if they were tokens with 6 decimals. For example, a logical asset amount for $5.75 is `5.75 * 10^6`. This allows us to map logical asset amounts to popular token amounts with no loss in precision because USDC and USDT have 6 decimals (requiring no widening) and ETH and DAI have 18 decimals (logical assets can be widened with no loss in precision by multiplying the logical asset amount by 10^12). However, this modeling means that logical assets can't express the full precision of ETH and DAI, eg. logical assets can't express the precision of wei or gwei

// parseLogicalAssetAmount takes a string representation of a float
// amount, such as "5.75" and returns the logical asset integer amount
// based on the number of token decimals used for logical assets.
export function parseLogicalAssetAmount(amount: string): BigNumber {
  return parseUnits(amount, logicalAssetDecimals);
}

const ten: BigNumber = BigNumber.from(10);

// convertLogicalAssetUnits converts the passed logicalAssetAmount
// (which is assumed to have logicalAssetDecimals decimal places
// because it was constructed with parseLogicalAssetAmount) into the
// passed newDecimals count of decimal places. For example,
// `convertLogicalAssetUnits(myLogicalAssetAmount, DAI.decimals)`
// converts the passed logical asset amount into a DAI amount.
export function convertLogicalAssetUnits(logicalAssetAmount: BigNumber, newDecimals: number): BigNumber {
  if (newDecimals < logicalAssetDecimals) throw new Error(`convertLogicalAssetUnits: unsupported narrowing of passed logical asset amount to newDecimals=${newDecimals}`); // TODO support narrowing
  return logicalAssetAmount.mul(ten.pow(newDecimals - logicalAssetDecimals));
}

// getDecimalsToRenderForTLogicalAsseticker returns the canonical
// number of digits after the decimal point to render for a logical
// asset based on its passed ticker.
export function getDecimalsToRenderForLogicalAssetTicker(ticker: LogicalAssetTicker): number {
  switch (ticker) {
    case 'ETH': return 4;
    case 'USD': return 2;
    case 'CAD': return 2;
    case 'EUR': return 2;
  }
}
