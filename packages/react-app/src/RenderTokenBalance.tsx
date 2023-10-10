import React from "react";
import { RenderRawTokenBalance, RenderRawTokenBalanceProps } from "./RenderRawTokenBalance";
import { TokenBalance } from "./TokenBalance";
import { getSupportedChainName } from "./chains";
import { getTokenByTokenKey } from "./tokens";

type RenderTokenBalanceProps = {
  tb: TokenBalance;
  opts?: RenderRawTokenBalanceProps['opts']
}

// RenderTokenBalance is a referentially transparent component to
// render the passed TokenBalance.
export const RenderTokenBalance: React.FC<RenderTokenBalanceProps> = (props) => {
  const t = getTokenByTokenKey(props.tb.tokenKey);
  return <RenderRawTokenBalance
    balance={props.tb.balanceAsBigNumberHexString}
    ticker={t.ticker}
    decimals={t.decimals}
    chainName={getSupportedChainName(t.chainId)}
    {...(props.opts && { opts: props.opts })}
  />;
}
