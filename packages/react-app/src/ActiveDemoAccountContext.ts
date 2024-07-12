import { createContext } from "react";
import { type Observer, makeObservableValue } from './observer';

// ActiveDemoAccountContext provides an observer for the currently
// active demo account managed via DemoAccountProvider. If the observed
// value is defined, then it's the active demo account (address or ens).
// Otherwise, the observed value is undefined and no demo account is
// active. A demo account is a read-only impersonated connected wallet
// for demo purposes. WARNING this context must only be provided by
// DemoAccountProvider and used by useActiveDemoAccount, and not
// directly consumed by anything else
export const ActiveDemoAccountContext = createContext<Observer<string | undefined>>(makeObservableValue<string | undefined>(undefined).observer);
