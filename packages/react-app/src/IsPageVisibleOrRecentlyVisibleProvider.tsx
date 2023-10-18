import React, { FC, useEffect, useState } from 'react';
import { IsPageVisibleOrRecentlyVisibleContext } from './IsPageVisibleOrRecentlyVisibleContext';
import { ObservableValue, Observer, makeObservableValue, useObservedValue } from './observer';
import useDebounce from './useDebounce';

type IsPageVisibleOrRecentlyVisibleProviderProps = {
  children?: React.ReactNode;
  opts?: UseIsPageVisibleOrRecentlyVisibleOpts;
}

// IsPageVisibleOrRecentlyVisibleProvider is a global provider to
// provide data for useIsPageVisibleOrRecentlyVisible. By using observer
// indirection, IsPageVisibleOrRecentlyVisibleProvider prevents
// useIsPageVisibleOrRecentlyVisible from re-rendering unnecessarily.
export const IsPageVisibleOrRecentlyVisibleProvider: FC<IsPageVisibleOrRecentlyVisibleProviderProps> = ({ children, opts }) => {
  const [isPageVisibleOrRecentlyVisibleOv] = useState(() => makeObservableValue<boolean>(true));
  return <>
    <IsPageVisibleOrRecentlyVisibleProviderInner isPageVisibleOrRecentlyVisibleObserver={isPageVisibleOrRecentlyVisibleOv.observer}>
      {children}
    </IsPageVisibleOrRecentlyVisibleProviderInner>
    <IsPageVisibleOrRecentlyVisibleUpdater ov={isPageVisibleOrRecentlyVisibleOv} {...(opts && { opts })} />
  </>;
};

type IsPageVisibleOrRecentlyVisibleProviderInnerProps = IsPageVisibleOrRecentlyVisibleProviderProps & {
  isPageVisibleOrRecentlyVisibleObserver: Observer<boolean>;
}

// IsPageVisibleOrRecentlyVisibleProviderInner exists to prevent
// IsPageVisibleOrRecentlyVisibleUpdater from redundantly rerendering
// when isPageVisibleOrRecentlyVisible changes. Ie. if
// IsPageVisibleOrRecentlyVisibleContext.Provider is included directly
// in IsPageVisibleOrRecentlyVisibleProvider, then we have the render
// flow (IsPageVisibleOrRecentlyVisibleUpdater rerenders because
// isPageVisibleOrRecentlyVisible changes ->
// IsPageVisibleOrRecentlyVisibleProvider rerenders on observed value
// update -> IsPageVisibleOrRecentlyVisibleUpdater rerenders because its
// parent rerendered).
const IsPageVisibleOrRecentlyVisibleProviderInner: FC<IsPageVisibleOrRecentlyVisibleProviderInnerProps> = ({ children, isPageVisibleOrRecentlyVisibleObserver }) => {
  const isPageVisibleOrRecentlyVisible: boolean = useObservedValue(isPageVisibleOrRecentlyVisibleObserver);
  return <IsPageVisibleOrRecentlyVisibleContext.Provider value={isPageVisibleOrRecentlyVisible}>
    {children}
  </IsPageVisibleOrRecentlyVisibleContext.Provider>;
};

// the core visibility code here is a fork of https://github.com/pgilad/react-page-visibility

const hasDocument: boolean = typeof document !== 'undefined';
const vendorEvents = [
  {
    hidden: 'hidden',
    event: 'visibilitychange',
    state: 'visibilityState',
  },
  {
    hidden: 'webkitHidden',
    event: 'webkitvisibilitychange',
    state: 'webkitVisibilityState',
  },
  {
    hidden: 'mozHidden',
    event: 'mozvisibilitychange',
    state: 'mozVisibilityState',
  },
  {
    hidden: 'msHidden',
    event: 'msvisibilitychange',
    state: 'msVisibilityState',
  },
  {
    hidden: 'oHidden',
    event: 'ovisibilitychange',
    state: 'oVisibilityState',
  },
];

const isSupported = hasDocument && Boolean(document.addEventListener);

const visibility = (() => {
  if (!isSupported) {
    return undefined;
  } else {
    let evt = undefined;
    for (const event of vendorEvents) {
      if (event.hidden in document) {
        evt = event;
        break;
      }
    }
    return evt;
  }
})();

const getHandlerArgs = () => {
  if (!visibility) return [true, 'visible']; // this line of code is what ensures the page is permanently detected as visible if the browser doesn't support visibility detection
  else {
    const { hidden, state } = visibility;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return [!document[hidden], document[state]];
  }
};

const isSupportedLocal = isSupported && visibility;

// useIsPageVisible returns true iff the current page is visible
// according to the rules of the Page Visibility API
// https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API.
// If useIsPageVisible returns false, it indicates the app is in the
// background and not being actively used by the user. NB that
// useIsPageVisible indicates if the entire app/browser tab is visible.
// To determine if a particular element is visible in the viewport, use
// eg. https://github.com/joshwnj/react-visibility-sensor
// useIsPageVisible isn't exported because clients should instead use
// useIsPageRecentlyVisible because WARNING useIsPageVisible re-renders
// every time the page's visibility status changes, such as if the user
// rapidly switches browser tabs.
const useIsPageVisible: () => boolean = () => {
  const [isPageVisible, setIsPageVisible] = useState<boolean>(() => {
    const [initiallyVisible] = getHandlerArgs();
    return initiallyVisible;
  });

  useEffect(() => {
    if (isSupportedLocal && visibility) { // isSupportedLocal is true only if visibility is defined, but we add a redundant check for visibility to satisfy the typescript compiler that visibility is defined for its usages below
      const handler = () => {
        const [currentlyVisible] = getHandlerArgs();
        setIsPageVisible(currentlyVisible);
      };
      document.addEventListener(visibility.event, handler);
      return () => {
        document.removeEventListener(visibility.event, handler);
      };
    } else return;
  }, []);

  // The below code works to determine if document is focused. I was curious by the comments in https://github.com/pgilad/react-page-visibility/issues/21 and ran an experiment to see if tracking "document is focused" might be useful to track in addition to isVisible. It didn't seem to be useful, as the focus state was dependent more on if the user was clicking in the app currently, and less around anything related to page visibility.
  // const [isFocused, setIsFocused] = useState<boolean>(() => document.hasFocus());
  // useEffect(() => {
  //   const blurHandler = () => setIsFocused(false);
  //   const focusHandler = () => setIsFocused(true);
  //   document.addEventListener("blur", blurHandler, true);
  //   document.addEventListener("focus", focusHandler, true);
  //   return () => {
  //     document.removeEventListener("blur", blurHandler, true);
  //     document.removeEventListener("focus", focusHandler, true);
  //   };
  // }, []);

  return isPageVisible;
};

interface UseIsPageVisibleOrRecentlyVisibleOpts {
  recentMillis?: number; // definition of "recent" in milliseconds. Ie. duration of the window during which the page is considered to have been recently visible
}

// useCalcIsPageVisibleOrRecentlyVisible calculates
// isPageVisibleOrRecentlyVisible. useCalcIsPageVisibleOrRecentlyVisible
// re-renders every time the page toggles visibility status and is
// therefore unsuitable for client use and is used only internally to
// provide data for the client entrypoint
// useIsPageVisibleOrRecentlyVisible.
function useCalcIsPageVisibleOrRecentlyVisible(opts?: UseIsPageVisibleOrRecentlyVisibleOpts): boolean {
  const recentMillis = opts?.recentMillis ?? 13_000;
  const isPageVisible = useIsPageVisible();
  const flushDebounce = isPageVisible; // if the page is visible, immediately flush this into the debounced value, otherwise isPageRecentlyVisible would be incorrect in the following case: page is invisible for a long time, page becomes visible, then page quickly becomes invisible again --> now we have isPageRecentlyVisible==false because the debounce timer didn't elapse before isPageVisible became false again.
  const isPageVisibleOrRecentlyVisible = useDebounce(isPageVisible, recentMillis, flushDebounce);
  return isPageVisibleOrRecentlyVisible;
}

type IsPageVisibleOrRecentlyVisibleUpdaterProps = {
  ov: ObservableValue<boolean>;
  opts?: UseIsPageVisibleOrRecentlyVisibleOpts;
}

const IsPageVisibleOrRecentlyVisibleUpdater: FC<IsPageVisibleOrRecentlyVisibleUpdaterProps> = ({ ov, opts }) => {
  const isPageVisibleOrRecentlyVisible: boolean = useCalcIsPageVisibleOrRecentlyVisible(opts);
  useEffect(
    () => ov.setValueAndNotifyObservers(isPageVisibleOrRecentlyVisible),
    [ov, opts, isPageVisibleOrRecentlyVisible],
  );
  return undefined;
};
