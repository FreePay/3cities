import { useEffect, useState } from "react";
import { useIsPageVisibleOrRecentlyVisible } from "./useIsPageVisible";

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
    }, 20_000); // TODO I'd prefer the data refresh rate to be quicker than 20 seconds, but right now we make O(tokens * chains) requests, whereas after we switch to the bulk useContractReads API, it'll be O(chains), and then the refresh latency could decrease
    return () => clearInterval(interval);
  }, [setIsForceDisable]);

  useEffect(() => { // short one-off timer to trigger re-enable
    if (isForceDisable) {
      let timeout: NodeJS.Timeout | undefined = setTimeout(() => {
        timeout = undefined;
        setIsForceDisable(false);
      }, 500);
      return () => {
        if (timeout) clearTimeout(timeout);
      };
    } else return;
  }, [isForceDisable, setIsForceDisable]);

  const isPageVisibleOrRecentlyVisible = useIsPageVisibleOrRecentlyVisible();

  const isEnabled = isPageVisibleOrRecentlyVisible && !isForceDisable;

  return isEnabled;
}
