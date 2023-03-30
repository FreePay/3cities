import { useEffect, useState } from "react";
import useDebounce from "./useDebounce";
import { useIsPageVisible } from "./useIsPageVisible";

// useIsEnabledSmartRefresh returns an `isEnabled` flag which can be passed
// to a wagmi hook to (i) brief set enabled==false every N seconds, which
// has the effect of forcing the hook to reload its data, and (ii) set
// enabled==false if the app hasn't been visible for a short while, to
// prevent data refreshes while the user isn't using the app. NB we
// explored solutions with wagmi hook APIs like `watch: true` and
// `staleTime/cacheTime`, and none of them worked for us. See 'redesign of
// live balance fetching' in 3cities design.
// Example: useBalance({ enabled: isEnabledFromThisHook })
export function useIsEnabledSmartRefresh() {
  const [isForceDisable, setIsForceDisable] = useState(false);

  useEffect(() => { // long periodic timer to trigger disable
    const interval = setInterval(() => {
      setIsForceDisable(true);
    }, 10_000);
    return () => clearInterval(interval);
  }, [setIsForceDisable]);

  useEffect(() => { // short one-off timer to trigger re-enable
    if (isForceDisable) {
      let timeout: NodeJS.Timeout | undefined = setTimeout(() => {
        timeout = undefined;
        setIsForceDisable(false);
      }, 500);
      return () => {
        if (timeout) clearTimeout(timeout)
      };
    }
    return;
  }, [isForceDisable, setIsForceDisable]);

  const isPageVisible = useIsPageVisible();
  const flushDebounce = isPageVisible; // if the page is visible, immediately flush this into the debounced value, otherwise isPageRecentlyVisible would be incorrect in the following case: page is invisible for a long time, page becomes visible, then page quickly becomes invisible again --> now we have isPageRecentlyVisible==false because the debounce timer didn't elapse before isPageVisible became false again.
  const isPageVisibleOrRecentlyVisible = useDebounce(isPageVisible, 13_000, flushDebounce);

  const isEnabled =
    isPageVisibleOrRecentlyVisible // to save on our rpc cloud bill and minimize client load, refresh balances only if page is visible or was recently visible. The "if was recently visible" part is important so that if a user rapidly hides/shows the app, we aren't rapidly toggling enabled and refreshing data every time the app is hidden and then shown again.
    && !isForceDisable;

  return isEnabled;
}
