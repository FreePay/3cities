import React from "react";
import { RenderRawTokenBalance, RenderRawTokenBalanceProps } from "./RenderRawTokenBalance";
import { TokenBalance } from "./TokenBalance";
import { getTokenByTokenKey } from "./tokens";

type RenderTokenBalanceProps = {
  tb: TokenBalance;
  opts?: RenderRawTokenBalanceProps['opts']
}

// RenderTokenBalance is a referentially transparent component to render
// the passed TokenBalance.
export const RenderTokenBalance: React.FC<RenderTokenBalanceProps> = (props) => {
  return <RenderRawTokenBalance
    balance={props.tb.balanceAsBigNumberHexString}
    nativeCurrencyOrToken={getTokenByTokenKey(props.tb.tokenKey)}
    {...(props.opts && { opts: props.opts })}
  />;
}
