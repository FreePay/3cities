import React from "react";
import { RenderRawTokenBalance } from "./RenderRawTokenBalance";
import { NativeCurrency, Token, isToken } from "./Token";
import { useLiveNativeCurrencyBalance } from "./useLiveNativeCurrencyBalance";
import { useLiveTokenBalance } from "./useLiveTokenBalance";

type RenderLiveTokenBalanceProps = {
  address: `0x${string}`; // address whose token balance will be live-reloaded and rendered
  nativeCurrencyOrToken: NativeCurrency | Token; // native currency or token whose address balance will be live-reloaded and rendered
};

// RenderLiveTokenBalance renders an auto-updated token balance for the
// passed address and native currency or token. WARNING
// RenderLiveTokenBalance accepts arbitary addresses and bypasses our
// AddressContext/useConnectedAccountContext system, and so each
// instantiation of RenderLiveTokenBalance results in incremental data
// fetches.
export const RenderLiveTokenBalance: React.FC<RenderLiveTokenBalanceProps> = ({ address, nativeCurrencyOrToken }) => {
  return isToken(nativeCurrencyOrToken) ? // react hooks can't be called conditionally, but components can be rendered conditionally, so here we conditionally render either a Token balance or a NativeCurrency balance, and then the rendered component calls its hooks unconditionally
    <RenderLiveTokenBalanceInternal address={address} token={nativeCurrencyOrToken} /> :
    <RenderLiveNativeCurrencyBalance address={address} nativeCurrency={nativeCurrencyOrToken} />;
}

type RenderLiveNativeCurrencyBalanceProps = {
  address: `0x${string}`;
  nativeCurrency: NativeCurrency;
};
const RenderLiveNativeCurrencyBalance: React.FC<RenderLiveNativeCurrencyBalanceProps> = ({ address, nativeCurrency }) => {
  const b = useLiveNativeCurrencyBalance(address, nativeCurrency.chainId);
  return <RenderRawTokenBalance
    balance={b}
    nativeCurrencyOrToken={nativeCurrency}
  />;
}

type RenderLiveTokenBalanceInternalProps = {
  address: `0x${string}`;
  token: Token;
};
const RenderLiveTokenBalanceInternal: React.FC<RenderLiveTokenBalanceInternalProps> = ({ address, token }) => {
  const b = useLiveTokenBalance(token.contractAddress, address, token.chainId);
  return <RenderRawTokenBalance
    balance={b}
    nativeCurrencyOrToken={token}
  />;
}
