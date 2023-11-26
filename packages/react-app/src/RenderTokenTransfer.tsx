import { formatUnits } from "@ethersproject/units";
import React from "react";
import { getSupportedChainName } from "./chains";
import { FormatFloatOpts, formatFloat } from "./formatFloat";
import { getDecimalsToRenderForTokenTicker, getDefaultTruncateTrailingZeroesForTokenTicker } from "./logicalAssetsToTokens";
import { ProposedTokenTransfer, TokenTransfer } from "./tokenTransfer";

type RenderTokenTransferProps = {
  tt: TokenTransfer;
  // TODO instead of these opts, it might be better to have subcomponents like RenderTokenTransferAmount, RenderTokenTransferAmountAndTicker, etc. and then clients can just use those if they don't want the full render --> there's also a missing use case where often people will refer to a token as "Goerli DAI" but these components only support putting the chain at the end of the render --> need to investigate design alternatives. Maybe a 'mode' for a list of 4-5 different modes. Or a format string so the client can control where everything is rendered, eg. format='%c %t' -> 'Goerli DAI'
  opts?: {
    hideAmount?: true; // iff true, the amount won't be rendered.
    hideTicker?: true; // iff true, the ticker won't be rendered.
    hideChainSeparator?: true; // iff true, the separator between the ticker and chain won't be rendered (ie hides the word "on").
    hideChain?: true; // iff true, the chain won't be rendered.
    truncateTrailingZeroes?: boolean; // iff true, any zeroes (after the decimal point AND after the last significant digit that wasn't rounded) will be truncated. Iff undefined, the passed ticker's default truncateTrailingZeroes will be used.
  }
}

// RenderTokenTransfer is a referentially transparent component to
// render the passed token transfer.
export const RenderTokenTransfer: React.FC<RenderTokenTransferProps> = ({ tt, opts }) => {
  const t = tt.token;
  const formatFloatOpts: FormatFloatOpts = {
    truncateTrailingZeroes: opts?.truncateTrailingZeroes !== undefined ? opts.truncateTrailingZeroes : getDefaultTruncateTrailingZeroesForTokenTicker(t.ticker),
  };
  // TODO it'd be nice to show the token image instead of the ticker (eg. USDC icon instead of "USDC"), and the same for the chain --> some apps have adopted the convention of showing a little chain icon in the top left of the token icon... maybe I should do that? where's the open-source code and assets to do so?
  return <span>{opts?.hideAmount !== true && formatFloat(formatUnits(tt.amountAsBigNumberHexString, t.decimals), getDecimalsToRenderForTokenTicker(t.ticker), formatFloatOpts)}{opts?.hideTicker !== true && ` ${t.tickerCanonical || t.ticker}`}{opts?.hideChainSeparator !== true && ' on'}{opts?.hideChain !== true && ` ${getSupportedChainName(t.chainId)}`}</span>;
}

type RenderProposedTokenTransferProps = {
  ptt: ProposedTokenTransfer;
}

// RenderProposedTokenTransfer is a referentially transparent component
// to render the passed proposed token transfer.
export const RenderProposedTokenTransfer: React.FC<RenderProposedTokenTransferProps> = ({ ptt }) => {
  const t = ptt.token;
  return <span>Pay {formatFloat(formatUnits(ptt.amountAsBigNumberHexString, t.decimals), getDecimalsToRenderForTokenTicker(t.ticker))} {t.tickerCanonical || t.ticker} on {getSupportedChainName(t.chainId)
  }</span>
}
