import { NativeCurrency, Token, isToken } from "./Token";
import React from "react";
import { getSupportedChainName } from "./chains";
import { useLiveNativeCurrencyBalance } from "./hooks/useLiveNativeCurrencyBalance";
import { useLiveTokenBalance } from "./hooks/useLiveTokenBalance";
import { RenderRawTokenBalance } from "./RenderRawTokenBalance";

type RenderLiveTokenBalanceProps = {
  address: string; // address whose token balance will be live-reloaded and rendered
  nativeCurrencyOrToken: NativeCurrency | Token; // native currency or token whose address balance will be live-reloaded and rendered
};
export const RenderLiveTokenBalance: React.FC<RenderLiveTokenBalanceProps> = ({ address, nativeCurrencyOrToken }) => {
  return isToken(nativeCurrencyOrToken) ? // react hooks can't be called conditionally, but components can be rendered conditionally, so here we conditionally render either a Token balance or a NativeCurrency balance, and then the rendered component calls its hooks unconditionally
    <RenderLiveTokenBalanceInternal address={address} token={nativeCurrencyOrToken} /> :
    <RenderLiveNativeCurrencyBalance address={address} nativeCurrency={nativeCurrencyOrToken} />;
}

type RenderLiveNativeCurrencyBalanceProps = {
  address: string;
  nativeCurrency: NativeCurrency;
};
const RenderLiveNativeCurrencyBalance: React.FC<RenderLiveNativeCurrencyBalanceProps> = ({ address, nativeCurrency }) => {
  const b = useLiveNativeCurrencyBalance(address, nativeCurrency.chainId);
  return <RenderRawTokenBalance
    balance={b}
    ticker={nativeCurrency.ticker}
    decimals={nativeCurrency.decimals}
    chainName={getSupportedChainName(nativeCurrency.chainId)}
  />;
}

type RenderLiveTokenBalanceInternalProps = {
  address: string;
  token: Token;
};
const RenderLiveTokenBalanceInternal: React.FC<RenderLiveTokenBalanceInternalProps> = ({ address, token }) => {
  const b = useLiveTokenBalance(token.contractAddress, address, token.chainId);
  return <RenderRawTokenBalance
    balance={b}
    ticker={token.ticker}
    decimals={token.decimals}
    chainName={getSupportedChainName(token.chainId)}
  />;
}
