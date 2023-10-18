import { useEffect, useState } from "react";
import { useIsPageVisibleOrRecentlyVisible } from "./useIsPageVisibleOrRecentlyVisible";

// TODO add a feature to protect our ethrpc bill by greatly slowing down the refresh rate after the page has been recently visible for a long period of time. This protects us from eg. a user leaving the window open over the weekend. --> eg. IF page has been recently visible for N minutes THEN decrease refresh frequency to 5 minutes instead of 20 seconds. Or even disable refreshing entirely --> design to do this: add a new provider that consumes useIsPageRecentlyVisible and provides useIsPageIdle and then consume useIsPageIdle here to disable refreshing --> a visual indicator can be added to Main/Conversion wrapper (such as a status banner on the top) indicating that data refreshes have been disabled (to re-enable, navigate to another tab and back and/or refresh page)

// useIsEnabledSmartRefresh returns an `isEnabled` flag which can be passed
// to a wagmi hook to (i) brief set enabled==false every N seconds, which
// has the effect of forcing the hook to reload its data, and (ii) set
// enabled==false if the app hasn't been visible for a short while, to
// prevent data refreshes while the user isn't using the app. NB we
// explored solutions with wagmi hook APIs like `watch: true` and
// `staleTime/cacheTime`, and none of them worked for us. See 'redesign of
// live balance fetching' in 3cities design.
// Example: useBalance({ enabled: isEnabledFromThisHook })
export function useIsEnabledSmartRefresh(): boolean {
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
