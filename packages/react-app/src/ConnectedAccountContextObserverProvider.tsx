import { BigNumber } from '@ethersproject/bignumber';
import React, { useCallback, useEffect, useState } from 'react';
import { useImmer } from 'use-immer';
import { useAccount } from 'wagmi';
import { AddressContext, emptyAddressContext } from './AddressContext';
import { ConnectedAccountContextObserverContext } from './ConnectedAccountContextObserverContext';
import { NativeCurrency, Token } from './Token';
import { TokenBalance, isDust } from './TokenBalance';
import { ObservableValueUpdater, makeObservableValue } from './observer';
import { getTokenKey, nativeCurrencies, tokens } from './tokens';
import { useLiveNativeCurrencyBalance } from './useLiveNativeCurrencyBalance';
import { useLiveTokenBalance } from './useLiveTokenBalance';

type ConnectedAccountContextObserverProviderProps = {
  children?: React.ReactNode;
}

// ConnectedAccountContextObserverProvider is a global provider to
// provide data for useConnectedAccountContext. By using observer
// indirection, ConnectedAccountContextObserverProvider prevents the
// client entrypoint useConnectedAccountContext from re-rendering
// unnecessarily.
export const ConnectedAccountContextObserverProvider: React.FC<ConnectedAccountContextObserverProviderProps> = ({ children }) => {
  const [ov] = useState(() => makeObservableValue<AddressContext | undefined>(undefined));
  return <>
    <ConnectedAccountContextObserverContext.Provider value={ov.observer}>
      {children}
    </ConnectedAccountContextObserverContext.Provider>
    <ConnectedAccountContextUpdater ovu={ov} />
  </>
};

type NativeCurrencyBalanceUpdaterProps = {
  nonce: number; // a nonce whose increment will cause the current native currency balance to be flushed into the updateNativeCurrencyBalance callback. Used to avoid a useEffect race condition where updated balances are pushed into the updateNativeCurrencyBalance callback and then discarded because the client AddressContext is reset to the empty value after the updated balances are applied
  address: `0x${string}`; // address whose native currency balance we'll keep updated
  nativeCurrency: NativeCurrency; // nativeCurrency whose balance we'll keep updated
  updateNativeCurrencyBalance: (nc: NativeCurrency, b: BigNumber | undefined) => void; // callback we must call when native currency balance updates
}
const NativeCurrencyBalanceUpdater: React.FC<NativeCurrencyBalanceUpdaterProps> = ({ nonce, address, nativeCurrency, updateNativeCurrencyBalance }) => {
  const b = useLiveNativeCurrencyBalance(address, nativeCurrency.chainId);
  useEffect(() => {
    updateNativeCurrencyBalance(nativeCurrency, b);
  }, [nativeCurrency, address, updateNativeCurrencyBalance, b, nonce]);
  return <></>; // nothing to render, this component only maintains state
}

type TokenBalanceUpdaterProps = {
  nonce: number; // a nonce whose increment will cause the current token balance to be flushed into the updateTokenBalance callback. Used to avoid a useEffect race condition where updated balances are pushed into the updateTokenBalance callback and then discarded because the AddressContext is client reset to the empty value after the updated balances are applied
  address: `0x${string}`; // address whose token balance we'll update
  token: Token; // token whose balance we'll update
  updateTokenBalance: (t: Token, b: BigNumber | undefined) => void; // callback we must call when token balance updates
}
const TokenBalanceUpdater: React.FC<TokenBalanceUpdaterProps> = ({ nonce, address, token, updateTokenBalance }) => {
  const b = useLiveTokenBalance(token.contractAddress, address, token.chainId);
  useEffect(() => {
    // console.log("TokenBalanceUpdater calling callback", token, b?._hex);
    updateTokenBalance(token, b);
  }, [token, address, updateTokenBalance, b, nonce]);
  return <></>; // nothing to render, this component only maintains state
}

type ConnectedAccountContextUpdaterInnerProps = {
  ovu: ObservableValueUpdater<AddressContext | undefined>;
  connectedAccount: `0x${string}`;
}
const ConnectedAccountContextUpdaterInner: React.FC<ConnectedAccountContextUpdaterInnerProps> = ({ ovu, connectedAccount }) => {
  const [ac, setAC] = useImmer<AddressContext>(emptyAddressContext(connectedAccount)); // ie. here we initialize an empty AddressContext for the currently connected account because no token balances have been loaded yet. The TokenBalanceUpdaters/NativeCurrencyUpdaters will be mounted below, and they will be responsible for executing callbacks to trigger updates of individual TokenBalances

  const [acResetNonce, setACResetNonce] = useState(0); // a nonce that's incremented every time AddressContext is reset to an empty value by the useEffect below, used to serialize the effects of resetting AddressContext to an empty value vs. updating token balances, to eliminate the race condition where fresh balance updates are lost because they are flushed before the AddressContext is reset

  useEffect(() => {
    if (connectedAccount !== ac.address) { // if connectedAccount changes, we need to reset the AddressContext to an empty value to avoid retaining a stale AdddressContext from the previous connected account
      setAC(emptyAddressContext(connectedAccount));
      setACResetNonce(n => n + 1); // increment acResetNonce to trigger a flush of token balances into the new AddressContext. If we didn't do this, there's a race condition where updated balances may have been applied to the old AddressContext prior to the reset
    } else {
      // console.log("ConnectedAccountContextUpdaterInner skipped set empty AddressContext because connectedAccount === ac.address");
    }
  }, [connectedAccount, ac.address, setAC, setACResetNonce]);

  useEffect(() => {
    // here we actually notify observers when AddressContext has changed
    // console.log("setValueAndNotifyObservers(AddressContext)", JSON.stringify(ac));
    ovu.setValueAndNotifyObservers(ac);
  }, [ovu, ac]);

  const updateNativeCurrencyOrTokenBalance = useCallback((nativeCurrencyOrToken: NativeCurrency | Token, newBalance: BigNumber | undefined) => { // updateNativeCurrencyOrTokenBalance is a single callback to be shared among all NativeCurrencyUpdaters/TokenBalanceUpdaters because each updater passes its own NativeCurrency/Token to this callback to be mapped into a tokenKey to then update AddressContext. Alternatively, we could have baked/curried the NativeCurrency/Token into the callback and created N callbacks, one per token
    // console.log("top of updateNativeCurrencyOrTokenBalance callback");
    setAC(draft => {
      // console.log("top of updateNativeCurrencyOrTokenBalance setAC body");
      const tk = getTokenKey(nativeCurrencyOrToken);
      if (newBalance === undefined) {
        // this token's balance couldn't be loaded for some reason, and so we delete it from AddressContext to avoid storing a stale token balance
        // console.log("updateNativeCurrencyOrTokenBalance callback delete tk", tk, 'cwa', connectedAccount, 'draft.address', draft.address);
        delete draft.tokenBalances[tk];
      } else {
        const tb: TokenBalance = {
          address: connectedAccount,
          tokenKey: tk,
          balanceAsBigNumberHexString: newBalance.toHexString(),
          balanceAsOf: Date.now(),
        };
        if (isDust(tb)) {
          // this token's balance is zero or dust. We want AddressContext to reflect useful token balances and so we'll treat this token balance as if it doesn't exist
          // console.log("ignoring token dust", JSON.stringify(tb));
          delete draft.tokenBalances[tk]; // delete any stale token balance
        } else {
          // console.log("updateNativeCurrencyOrTokenBalance callback, tb=", JSON.stringify(tb), 'cwa', connectedAccount, 'draft.address', draft.address);
          draft.tokenBalances[tk] = tb;
        }
      }
    });
  }, [connectedAccount, setAC]);

  return <>
    {tokens.map(t => <TokenBalanceUpdater
      nonce={acResetNonce}
      key={getTokenKey(t)}
      token={t}
      address={connectedAccount}
      updateTokenBalance={updateNativeCurrencyOrTokenBalance}
    />)}
    {nativeCurrencies.map(nc => <NativeCurrencyBalanceUpdater
      nonce={acResetNonce}
      key={getTokenKey(nc)}
      nativeCurrency={nc}
      address={connectedAccount}
      updateNativeCurrencyBalance={updateNativeCurrencyOrTokenBalance}
    />)}
  </>;
};

type ConnectedAccountContextUpdaterProps = {
  ovu: ObservableValueUpdater<AddressContext | undefined>;
}
const ConnectedAccountContextUpdater: React.FC<ConnectedAccountContextUpdaterProps> = ({ ovu }) => {
  const { address } = useAccount();
  // console.log('ConnectedAccountContextUpdater address', address);
  useEffect(() => {
    if (address === undefined) { // here we only need to setValueAndNotifyObservers if connectedAccount is undefined because if it's defined, we'll construct the AddressContext and call setValueAndNotifyObservers(defined value) in ConnectedAccountContextUpdaterInner, and if connectedAccount has transitioned from defined to undefined, the ConnectedAccountContextUpdaterInner component has been unmounted and it won't (and isn't designed to) call setValueAndNotifyObservers(undefined) to notify clients that the account has become disconnected, so we need to do it here
      // console.log("setValueAndNotifyObservers(AddressContext=undefined)");
      ovu.setValueAndNotifyObservers(undefined);
    }
  }, [ovu, address]);
  return address === undefined ? <></> : <ConnectedAccountContextUpdaterInner ovu={ovu} connectedAccount={address} />;
};
