import { formatUnits } from "@ethersproject/units";
import React from "react";
import { getSupportedChainName } from "./chains";
import { formatFloat } from "./formatFloat";
import { ReceiverProposedTokenTransfer } from "./strategies";
import { getDecimalsToRenderForTokenTicker } from "./tokens";
import { TokenTransfer } from "./tokenTransfer";

type RenderTokenTransferProps = {
  tt: TokenTransfer;
}

// RenderTokenTransfer is a referentially transparent component to render
// the passed strategy.
export const RenderTokenTransfer: React.FC<RenderTokenTransferProps> = ({ tt }) => {
  const t = tt.token;
  // TODO it'd be nice to show the token image instead of the ticker (eg. USDC icon instead of "USDC"), and the same for the chain --> some apps have adopted the convention of showing a little chain icon in the top left of the token icon... maybe I should do that? where's the open-source code and assets to do so?
  return <span>{formatFloat(formatUnits(tt.amountAsBigNumberHexString, t.decimals), getDecimalsToRenderForTokenTicker(t.ticker))} {t.ticker} on {getSupportedChainName(t.chainId)
  }</span>
}

type RenderReceiverProposedTokenTransferProps = {
  rptt: ReceiverProposedTokenTransfer;
}

// RenderProposedStrategy is a referentially transparent component to
// render the passed proposed strategy.
export const RenderReceiverProposedTokenTransfer: React.FC<RenderReceiverProposedTokenTransferProps> = ({ rptt }) => {
  const t = rptt.token;
  return <span>Pay {formatFloat(formatUnits(rptt.amountAsBigNumberHexString, t.decimals), getDecimalsToRenderForTokenTicker(t.ticker))} {t.ticker} on {getSupportedChainName(t.chainId)
  }</span>
}
