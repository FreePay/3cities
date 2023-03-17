import { formatUnits } from "@ethersproject/units";
import React from "react";
import { formatFloat } from "./formatFloat";
import { getChainName } from "./getChainName";
import { ProposedStrategy, Strategy } from "./strategies";
import { getDecimalsToRenderForTokenTicker } from "./tokens";

type RenderStrategyProps = {
  s: Strategy;
}

// RenderStrategy is a referentially transparent component to render
// the passed strategy.
export const RenderStrategy: React.FC<RenderStrategyProps> = ({ s }) => {
  const t = s.tokenTransfer.token;
  return <span>Pay {formatFloat(formatUnits(s.tokenTransfer.amountAsBigNumberHexString, t.decimals), getDecimalsToRenderForTokenTicker(t.ticker))} {t.ticker} on {getChainName(t.chainId)
  }</span>
}

type RenderProposedStrategyProps = {
  ps: ProposedStrategy;
}

// RenderProposedStrategy is a referentially transparent component to
// render the passed proposed strategy.
export const RenderProposedStrategy: React.FC<RenderProposedStrategyProps> = ({ ps }) => {
  const t = ps.receiverProposedTokenTransfer.token;
  return <span>Pay {formatFloat(formatUnits(ps.receiverProposedTokenTransfer.amountAsBigNumberHexString, t.decimals), getDecimalsToRenderForTokenTicker(t.ticker))} {t.ticker} on {getChainName(t.chainId)
  }</span>
}
