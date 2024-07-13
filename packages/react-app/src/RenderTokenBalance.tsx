import { getTokenByTokenKey } from "@3cities/core";
import React from "react";
import { RenderRawTokenBalance, type RenderRawTokenBalanceProps } from "./RenderRawTokenBalance";
import { type TokenBalance } from "./TokenBalance";

type RenderTokenBalanceProps = {
  tb: TokenBalance;
  opts?: RenderRawTokenBalanceProps['opts']
}

// RenderTokenBalance is a referentially transparent component to render
// the passed TokenBalance.
export const RenderTokenBalance: React.FC<RenderTokenBalanceProps> = (props) => {
  return <RenderRawTokenBalance
    balance={props.tb.balance}
    nativeCurrencyOrToken={getTokenByTokenKey(props.tb.tokenKey)}
    {...(props.opts && { opts: props.opts })}
  />;
}
