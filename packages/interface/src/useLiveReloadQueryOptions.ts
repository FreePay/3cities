import { useIsPageVisibleOrRecentlyVisible } from "./useIsPageVisibleOrRecentlyVisible";

// TODO add a feature to protect our ethrpc bill by greatly slowing down or stopping the refresh rate after the page has been recently visible or idle for a long period of time. Eg. add useIsPageIdle --> a visual indicator can be added to Main/Conversion wrapper (such as a status banner on the top) indicating that data refreshes have been disabled (to re-enable, navigate to another tab and back and/or refresh page; or other un-idle detection)

const liveReloadQueryOptions = {
  refetchInterval: 10_000,
  refetchIntervalInBackground: true, // NB because we set enabled=isPageVisibleOrRecentlyVisible and refetchIntervalInBackground=true, we are effectively refetching in the background iff the window was recently visible, which is our desired behavior. If we instead set refetchIntervalInBackground=false, then it's possible that the page could have permanently stale data in the case where the user was periodically unfocusing/refocusing the window and this unfocusing always coincided with the firing of the refetch interval - ie. the refetch interval always fires on the same timer regardless if the window is focused or unfocused, and simply skips its refetch if the window is unfocused at that moment, so the refetch only occurs if the page happens to be focused at the time the refetch interval fired. So we obviate this issue by setting refetchIntervalInBackground=true.
  refetchOnMount: true,
  refetchOnReconnect: true,
  refetchOnWindowFocus: false, // NB iff refetchOnWindowFocus is true, the query will be refetched upon every window focus, even if the window focuses are very rapid. So, we set refetchOnWindowFocus to false to avoid rapidly refetching on rapid refocuses, and instead rely on isPageVisibleOrRecentlyVisible to only refetch on window refocus after window has been unfocused for a while.
} as const;

// useLiveReloadQueryOptions returns 3cities's canonical tanstack query
// options to be used when a given query is intended to be live reloaded
// with continuously fresh data.
export function useLiveReloadQueryOptions() {
  const isPageVisibleOrRecentlyVisible = useIsPageVisibleOrRecentlyVisible();
  return {
    enabled: isPageVisibleOrRecentlyVisible,
    ...liveReloadQueryOptions,
  };
}
