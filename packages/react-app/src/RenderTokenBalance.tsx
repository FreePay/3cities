import React from "react";
import { getSupportedChainName } from "./chains";
import { RenderRawTokenBalance } from "./RenderRawTokenBalance";
import { TokenBalance } from "./TokenBalance";
import { getTokenByTokenKey } from "./tokens";

type RenderTokenBalanceProps = {
  tokenBalance: TokenBalance;
}

// RenderTokenBalance is a referentially transparent component to
// render the passed TokenBalance.
export const RenderTokenBalance: React.FC<RenderTokenBalanceProps> = ({ tokenBalance }) => {
  const t = getTokenByTokenKey(tokenBalance.tokenKey);
  return <RenderRawTokenBalance
    balance={tokenBalance.balanceAsBigNumberHexString}
    ticker={t.ticker}
    decimals={t.decimals}
    chainName={getSupportedChainName(t.chainId)}
  />;
}
