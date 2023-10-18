import { createContext } from "react";

export const IsPageVisibleOrRecentlyVisibleContext = createContext<boolean>(true); // the global flag indicating whether or not the page was recently visible. See IsPageVisibleOrRecentlyVisibleProvider. Default to true because page is typically visible when the app initially loads. WARNING this context must only be provided by IsPageVisibleOrRecentlyVisibleProvider and used by useIsPageVisibleOrRecentlyVisible, and not directly consumed by anything else
