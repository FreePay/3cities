import { BigNumber } from '@ethersproject/bignumber';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useImmer } from 'use-immer';
import { useAccount } from 'wagmi';
import { AddressContext, emptyAddressContext } from './addressContext';
import { useLiveNativeCurrencyBalance } from './hooks/useLiveNativeCurrencyBalance';
import { useLiveTokenBalance } from './hooks/useLiveTokenBalance';
import { makeObservableValue, ObservableValue, ObservableValueUpdater, Observer } from './observer';
import { NativeCurrency, Token } from './Token';
import { isDust, TokenBalance } from './TokenBalance';
import { getTokenKey, nativeCurrencies, tokens } from './tokens';

const ConnectedWalletAddressContextObserverContext = React.createContext<Observer<AddressContext | undefined> | undefined>(undefined);

type NativeCurrencyBalanceUpdaterProps = {
  nonce: number; // a nonce whose increment will cause the current native currency balance to be flushed into the updateNativeCurrencyBalance callback. Used to avoid a useEffect race condition where updated balances are pushed into the updateNativeCurrencyBalance callback and then discarded because the client AddressContext is reset to the empty value after the updated balances are applied
  address: string; // address whose native currency balance we'll keep updated
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
  address: string; // address whose token balance we'll update
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

type ConnectedWalletAddressContextUpdaterInnerProps = {
  ovu: ObservableValueUpdater<AddressContext | undefined>;
  connectedWalletAddress: string;
}
const ConnectedWalletAddressContextUpdaterInner: React.FC<ConnectedWalletAddressContextUpdaterInnerProps> = ({ ovu, connectedWalletAddress }) => {
  const [ac, setAC] = useImmer<AddressContext>(emptyAddressContext(connectedWalletAddress)); // ie. here we initialize an empty AddressContext for the currently connected wallet because no token balances have been loaded yet. The TokenBalanceUpdaters/NativeCurrencyUpdaters will be mounted below, and they will be responsible for executing callbacks to trigger updates of individual TokenBalances

  const [acResetNonce, setACResetNonce] = useState(0); // a nonce that's incremented every time AddressContext is reset to an empty value by the useEffect below, used to serialize the effects of resetting AddressContext to an empty value vs. updating token balances, to eliminate the race condition where fresh balance updates are lost because they are flushed before the AddressContext is reset

  useEffect(() => {
    if (connectedWalletAddress !== ac.address) { // if connectedWalletAddress changes, we need to reset the AddressContext to an empty value to avoid retaining a stale AdddressContext from the previous connected wallet address
      // console.log("ConnectedWalletAddressContextUpdaterInner set empty AddressContext)");
      setAC(emptyAddressContext(connectedWalletAddress));
      setACResetNonce(n => n + 1); // increment acResetNonce to trigger a flush of token balances into the new AddressContext. If we didn't do this, there's a race condition where updated balances may have been applied to the old AddressContext prior to the reset
    } else {
      // console.log("ConnectedWalletAddressContextUpdaterInner skipped set empty AddressContext because connectedWalletAddress === ac.address");
    }
  }, [connectedWalletAddress, ac.address, setAC, setACResetNonce]);

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
        // console.log("updateNativeCurrencyOrTokenBalance callback delete tk", tk, 'cwa', connectedWalletAddress, 'draft.address', draft.address);
        delete draft.tokenBalances[tk];
      } else {
        const tb: TokenBalance = {
          address: connectedWalletAddress,
          tokenKey: tk,
          balanceAsBigNumberHexString: newBalance.toHexString(),
          balanceAsOf: new Date().getTime(),
        };
        if (isDust(tb)) {
          // this token's balance is zero or dust. We want AddressContext to reflect useful token balances and so we'll treat this token balance as if it doesn't exist
          // console.log("ignoring token dust", JSON.stringify(tb));
          delete draft.tokenBalances[tk]; // delete any stale token balance
        } else {
          // console.log("updateNativeCurrencyOrTokenBalance callback, tb=", JSON.stringify(tb), 'cwa', connectedWalletAddress, 'draft.address', draft.address);
          draft.tokenBalances[tk] = tb;
        }
      }
    });
  }, [connectedWalletAddress, setAC]);

  return <>
    {tokens.map(t => <TokenBalanceUpdater
      nonce={acResetNonce}
      key={getTokenKey(t)}
      token={t}
      address={connectedWalletAddress}
      updateTokenBalance={updateNativeCurrencyOrTokenBalance}
    />)}
    {nativeCurrencies.map(nc => <NativeCurrencyBalanceUpdater
      nonce={acResetNonce}
      key={getTokenKey(nc)}
      nativeCurrency={nc}
      address={connectedWalletAddress}
      updateNativeCurrencyBalance={updateNativeCurrencyOrTokenBalance}
    />)}
  </>;
};

type ConnectedWalletAddressContextUpdaterProps = {
  ov: ObservableValue<AddressContext | undefined>; // TODO pass ObserverableValueUpdater instead of the wider ObservableValue
}
const ConnectedWalletAddressContextUpdater: React.FC<ConnectedWalletAddressContextUpdaterProps> = ({ ov }) => {
  const { address } = useAccount();
  // console.log('ConnectedWalletAddressContextUpdater address', address);
  // const connectedWalletAddress: string | undefined = typeof address === 'string' ? address : undefined;
  useEffect(() => {
    if (address === undefined) { // here we only need to setValueAndNotifyObservers if connectedWalletAddress is undefined because if it's defined, we'll construct the AddressContext and call setValueAndNotifyObservers(defined value) in ConnectedWalletAddressContextUpdaterInner, and if connectedWalletAddress has transitioned from defined to undefined, the ConnectedWalletAddressContextUpdaterInner component has been unmounted and it won't (and isn't designed to) call setValueAndNotifyObservers(undefined) to notify clients that the wallet has become disconnected, so we need to do it here
      // console.log("setValueAndNotifyObservers(AddressContext=undefined)");
      ov.setValueAndNotifyObservers(undefined);
    }
  }, [ov, address]);
  return address === undefined ? <></> : <ConnectedWalletAddressContextUpdaterInner ovu={ov} connectedWalletAddress={address} />;
};

type ConnectedWalletAddressContextObserverProviderProps = {
  children?: React.ReactNode;
}

export const ConnectedWalletAddressContextObserverProvider: React.FC<ConnectedWalletAddressContextObserverProviderProps> = ({ children }) => {
  const [ov] = useState(() => makeObservableValue<AddressContext | undefined>(undefined));
  return <ConnectedWalletAddressContextObserverContext.Provider value={ov.observer}>
    <ConnectedWalletAddressContextUpdater ov={ov} />
    {children}
  </ConnectedWalletAddressContextObserverContext.Provider>;
};

export function useConnectedWalletAddressContext(): AddressContext | undefined {
  const o: Observer<AddressContext | undefined> | undefined = useContext(ConnectedWalletAddressContextObserverContext);
  // here we inline the approximate contents of observer.ts's useObservedValue hook. We inline because we need to include an additional check for if `o === undefined` which occurs if this hook is used in a component that isn't a descendant of ConnectedWalletAddressContextObserverProvider
  const [ac, setAC] = useState<AddressContext | undefined>(() => {
    if (o === undefined) return undefined;
    return o.getCurrentValue();
  });

  useEffect(() => {
    if (o === undefined) {
      // Observer is undefined or has become undefined. This occurs when this hook is used in a component that isn't a descendant of ConnectedWalletAddressContextObserverProvider. We must setAC(undefined) to ensure that any stale defined AddressContext does not remain
      setAC(undefined);
      return;
    } else {
      setAC(o.getCurrentValue()); // here we explicitly set ac to the current value because if we don't then it'll be stale because it won't otherwise be updated until the next setValueAndNotifyObservers. Ie. if `o` was undefined and becomes defined, that'll trigger `o.subscribe(setAC)` but `ac` is undefined, so there must be a step to set `ac` to the current value as of when `o` becomes defined, which is what we're doing on this line
      return o.subscribe(setAC).unsubscribe; // after subscribing our state to AddressContext updates, we're sure to return the unsubscribe handler to ensure that this useEffect is cleaned up properly
    }
  }, [o, setAC]);

  return ac;
}
