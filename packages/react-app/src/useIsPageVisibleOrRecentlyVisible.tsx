import { useContext } from "react";
import { IsPageVisibleOrRecentlyVisibleContext } from "./IsPageVisibleOrRecentlyVisibleContext";

// useIsPageVisibleOrRecentlyVisible returns true iff the page is
// currently visible or has been visible in the past opts.recentMillis
// milliseconds (default 13 seconds). useIsPageVisibleOrRecentlyVisible
// re-renders iff the return value changes. Clients may use
// useIsPageVisibleOrRecentlyVisible to eg. refresh data fetches only if
// page visible or was recently visible to help minimize rpc load. The
// "if was recently visible" part is important so that if a user rapidly
// hides/shows the app, we aren't rapidly toggling and refreshing data
// every time the app is hidden and then shown again. See
// useIsPageVisible for details on how page visibility is detected.
export function useIsPageVisibleOrRecentlyVisible(): boolean {
  return useContext(IsPageVisibleOrRecentlyVisibleContext);
}
