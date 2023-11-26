import React from 'react';
import { AddressContext } from './AddressContext';
import { Observer, makeObservableValue } from './observer';

// ConnectedAccountContextObserverContext provides an observer for the
// connected account's AddressContext, which is automatically kept
// synced with latest onchain balances. WARNING this context must only
// be provided by ConnectedAccountContextObserverProvider and used by
// useConnectedAccountContext, and not directly consumed by anything
// else.
export const ConnectedAccountContextObserverContext = React.createContext<Observer<AddressContext | undefined>>(makeObservableValue<AddressContext | undefined>(undefined).observer);
