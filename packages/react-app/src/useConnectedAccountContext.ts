import { useContext } from 'react';
import { AddressContext } from './AddressContext';
import { ConnectedAccountContextObserverContext } from './ConnectedAccountContextObserverContext';
import { Observer, useObservedValue } from './observer';

// useConnectedAccountContext returns the connected account's
// AddressContext, which is automatically kept synced with latest
// onchain balances. However, there is some latency between onchain
// balance updates and those updates reflecting in AddressContext. As
// well, in some cases, automatic updates may be temporarily disabled,
// such as if 3cities detects the app is not visible.
export function useConnectedAccountContext(): AddressContext | undefined {
  const o: Observer<AddressContext | undefined> = useContext(ConnectedAccountContextObserverContext);
  return useObservedValue(o);
}
