import { useEffect, useState } from 'react';

// this is a fork of https://github.com/pgilad/react-page-visibility

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

export const isSupported = hasDocument && Boolean(document.addEventListener);

export const visibility = (() => {
  if (!isSupported) {
    return undefined;
  }
  for (const event of vendorEvents) {
    if (event.hidden in document) {
      return event;
    }
  }
  // otherwise it's not supported
  return undefined;
})();

export const getHandlerArgs = () => {
  if (!visibility) {
    return [true, 'visible'];
  }
  const { hidden, state } = visibility;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return [!document[hidden], document[state]];
};

const isSupportedLocal = isSupported && visibility;

// usePageVisibility returns true iff the current page is visible according
// to the rules of the Page Visibility API
// https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API. If
// usePageVisibility returns false, it indicates the app is in the
// background and not being actively used by the user. NB that
// usePageVisibility indicates if the entire app/browser tab is visible. To
// determine if a particular element is visible in the viewport, use eg.
// https://github.com/joshwnj/react-visibility-sensor
export const useIsPageVisible: () => boolean = () => {
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    const [initiallyVisible] = getHandlerArgs();
    return initiallyVisible;
  });

  useEffect(() => {
    if (isSupportedLocal && visibility) { // isSupportedLocal is true only if visibility is defined, but we add a redundant check for visibility to satisfy the typescript compiler that visibility is defined for its usages below
      const handler = () => {
        const [currentlyVisible] = getHandlerArgs();
        setIsVisible(currentlyVisible);
      };
      document.addEventListener(visibility.event, handler);
      return () => {
        document.removeEventListener(visibility.event, handler);
      };
    }
    return;
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

  return isVisible;
};
