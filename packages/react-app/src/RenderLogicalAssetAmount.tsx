import React from "react";
import { formatUnits } from "viem";
import { formatFloat, FormatFloatOpts } from "./formatFloat";
import { addCanonicalFormatToLogicalAssetValue, getDecimalsToRenderForLogicalAssetTicker, getDefaultTruncateTrailingZeroesForLogicalAssetTicker, logicalAssetDecimals, LogicalAssetTicker } from "./logicalAssets";

type RenderLogicalAssetAmountProps = {
  logicalAssetTicker: LogicalAssetTicker; // logical asset ticker of the amount to be rendered
  amount: bigint; // full-precision logical asset amount to render. Note that this amount must have been constructed using parseLogicalAssetAmount to properly respect logical asset decimal count
  truncateTrailingZeroes?: boolean; // iff true, any zeroes (after the decimal point AND after the last significant digit that wasn't rounded) will be truncated. Iff undefined, the passed logical asset ticker's default truncateTrailingZeroes will be used
}

// RenderLogicalAssetAmount is a referentially transparent component
// to render the passed logical asset balance.
export const RenderLogicalAssetAmount: React.FC<RenderLogicalAssetAmountProps> = (props) => {
  return <span>{renderLogicalAssetAmount(props)}</span>;
}

export function renderLogicalAssetAmount({ logicalAssetTicker, amount, truncateTrailingZeroes }: RenderLogicalAssetAmountProps): string {
  const formatFloatOpts: FormatFloatOpts = {
    truncateTrailingZeroes: truncateTrailingZeroes !== undefined ? truncateTrailingZeroes : getDefaultTruncateTrailingZeroesForLogicalAssetTicker(logicalAssetTicker),
  };
  const formattedFloat = formatFloat(formatUnits(amount, logicalAssetDecimals), getDecimalsToRenderForLogicalAssetTicker(logicalAssetTicker), formatFloatOpts);
  return `${addCanonicalFormatToLogicalAssetValue(logicalAssetTicker, formattedFloat)}`;
}
