import { createContext } from "react";
import { Observer, makeObservableValue } from './observer';

// IsPageVisibleOrRecentlyVisibleContext provides an observer for the
// global flag indicating whether or not the page was recently visible.
// See IsPageVisibleOrRecentlyVisibleProvider. Default to true because
// page is typically visible when the app initially loads. WARNING this
// context must only be provided by
// IsPageVisibleOrRecentlyVisibleProvider and used by
// useIsPageVisibleOrRecentlyVisible, and not directly consumed by
// anything else.
export const IsPageVisibleOrRecentlyVisibleContext = createContext<Observer<boolean>>(makeObservableValue<boolean>(true).observer);
