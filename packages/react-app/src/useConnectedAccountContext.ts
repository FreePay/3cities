import { useContext, useEffect, useState } from 'react';
import { AddressContext } from './AddressContext';
import { ConnectedAccountContextObserverContext } from './ConnectedAccountContextObserverContext';
import { Observer } from './observer';

// useConnectedAccountContext returns the connected account's
// AddressContext, which is automatically kept synced with latest
// onchain balances. However, there is some latency between onchain
// balance updates and those updates reflecting in AddressContext. As
// well, in some cases, automatic updates may be temporarily disabled,
// such as if 3cities detects the app is not visible.
export function useConnectedAccountContext(): AddressContext | undefined {
  const o: Observer<AddressContext | undefined> | undefined = useContext(ConnectedAccountContextObserverContext);
  // here we inline the approximate contents of observer.ts's useObservedValue hook. We inline because we need to include an additional check for if `o === undefined` which occurs if this hook is used in a component that isn't a descendant of ConnectedAccountContextObserverProvider
  const [ac, setAC] = useState<AddressContext | undefined>(() => {
    if (o === undefined) {
      throw new Error("useConnectedAccountContext called in a component that isn't a descendant of ConnectedAccountContextObserverProvider");
    } else return o.getCurrentValue();
  });

  useEffect(() => {
    if (o === undefined) {
      // Observer is undefined or has become undefined. This occurs when this hook is used in a component that isn't a descendant of ConnectedAccountContextObserverProvider. We must setAC(undefined) to ensure that any stale defined AddressContext does not remain
      setAC(undefined);
      throw new Error("useConnectedAccountContext called in a component that isn't a descendant of ConnectedAccountContextObserverProvider");
    } else {
      setAC(o.getCurrentValue()); // here we explicitly set ac to the current value because if we don't then it'll be stale because it won't otherwise be updated until the next setValueAndNotifyObservers. Ie. if `o` was undefined and becomes defined, that'll trigger `o.subscribe(setAC)` but `ac` is undefined, so there must be a step to set `ac` to the current value as of when `o` becomes defined, which is what we're doing on this line
      return o.subscribe(setAC).unsubscribe; // after subscribing our state to AddressContext updates, we're sure to return the unsubscribe handler to ensure that this useEffect is cleaned up properly
    }
  }, [o, setAC]);

  return ac;
}
