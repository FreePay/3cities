import React, { useCallback, useState } from "react";
import { Outlet, useMatches, useSearchParams } from "react-router-dom";
import { CheckoutSettings } from "./CheckoutSettings";
import { CheckoutSettingsContext } from "./CheckoutSettingsContext";
import { deserializeCheckoutSettings } from "./serialize";
import { useEffectSkipFirst } from "./useEffectSkipFirst";

// Design goals of CheckoutSettingsProvider (which were achieved)
//   1. centralize deserialization of CheckoutSettings, as it's a general payload required by various routes.
//   2. globally cache deserialized CheckoutSettings.
//   3. auto-update the current deserialized CheckoutSettings iff its url param changes.
//   3b. never redundantly re-render. Render exactly once for a valid CheckoutSettings whose url param never changes.
//   4. make the deserialized CheckoutSettings available on the initial render, so there is no render where it's unavailable.
//   5. make the deserialized CheckoutSettings unconditionally available to downstream clients, so they don't have to handle `checkoutSettings === undefined`.
//   6. if CheckoutSettings deserialization fails, render a configurable fallback component.
//   6b. render the fallback component without redirecting, which is convenient for the user as the url that errored stays in the browser's url bar where it can be copied/inspected.
//   6c. allow the fallback component to be conditional on the matching routes, so that a custom fallback component can be supplied based on the product context that errored (eg. if /pay produced the error, we want to show a "pay link not found" error page).

// An alternative design that was considered is to deserialize
// CheckoutSettings in a react-router v6 loader. However, using loaders
// has at least two issues. One, loader results are not made available
// to components in typesafe manner. Loaders use a purely dynamically
// typed API. Two, each loader execution has three possible result
// states: successful data load, redirect, or throw an error to the
// nearest error boundary. None of these three result states make it
// easy (or perhaps possible) to achieve design criteria 6b and 6c above
// because the elementForPathIfCheckoutSettingsNotFound design below
// would need to be replicated by the loader throwing an Error that
// described the configurable fallback and then a custom error boundary
// would parse that error and display the fallback element, an indirect
// an type-unsafe alternative to the direct and typesafe design offered
// by elementForPathIfCheckoutSettingsNotFound. --> In general, the main
// benefit of loaders seems to be that N loaders for N nested routes
// will run in parallel. But today, none of our components require data
// to be fetched before the initial render, so it's not beneficial to
// us.

const checkoutSettingsGlobalCache: { [serialized: string]: CheckoutSettings } = {}; // a global cache of (serialized CheckoutSettings -> deserialized CheckoutSettings) to prevent redundant deserializations. This is efficient enough because serialized CheckoutSettings are relatively short (today ranging from ~45 chars to 100s of chars)

type Props = {
  elementForPathIfCheckoutSettingsNotFound: { [path: string]: React.ReactNode }; // fallback element per react router path to render if CheckoutSettings couldn't be deserialized
}

export const serializedCheckoutSettingsUrlParam = "c"; // url param where CheckoutSettingsProvider expects to find the serialized CheckoutSettings. Clients constructing urls with serialized CheckoutSettings should use this export to ensure they are picking the url param correctly. In the future, we could fully hide this url param inside this library with an API like eg. addSerializedCheckoutSettingsToUrl(url: URL, cs: CheckoutSettings): URL

// CheckoutSettingsProvider is a provider component that makes a
// required CheckoutSettings available to descendant components via the
// useCheckoutSettings hook. If the required CheckoutSettings isn't
// found, CheckoutSettingsProvider will render a fallback element from
// the passed props.
export function CheckoutSettingsProvider(props: Props): React.ReactNode {
  const matches = useMatches();
  const [searchParams] = useSearchParams();
  const serializedCheckoutSettings = searchParams.get(serializedCheckoutSettingsUrlParam);

  const doDeserialize = useCallback((): CheckoutSettings | undefined => {
    // console.log("doDeserialize start");
    if (serializedCheckoutSettings === null) return undefined;
    else {
      if (!checkoutSettingsGlobalCache[serializedCheckoutSettings]) {
        // console.log("doDeserialize cache miss");
        const cs = deserializeCheckoutSettings(serializedCheckoutSettings);
        if (cs) checkoutSettingsGlobalCache[serializedCheckoutSettings] = cs;
      } else {
        // console.log("doDeserialize cache hit");
      }
      return checkoutSettingsGlobalCache[serializedCheckoutSettings];
    }
  }, [serializedCheckoutSettings]);

  const [checkoutSettings, setCheckoutSettings] = useState<CheckoutSettings | undefined>(doDeserialize);

  useEffectSkipFirst(() => {
    // console.log("redo doDeserialize");
    setCheckoutSettings(doDeserialize());
  }, [doDeserialize, setCheckoutSettings]);

  if (checkoutSettings) {
    return <CheckoutSettingsContext.Provider value={checkoutSettings}>
      <Outlet />
    </CheckoutSettingsContext.Provider>;
  } else {
    // checkoutSettings couldn't be deserialized, so we'll render a fallback element. The fallback element is configured per current route matches:
    let elForPath: React.ReactNode | undefined;
    for (const path of Object.keys(props.elementForPathIfCheckoutSettingsNotFound)) {
      const foundPath: boolean = matches.filter(m => m.pathname.includes(path)).length > 0;
      if (foundPath) {
        elForPath = props.elementForPathIfCheckoutSettingsNotFound[path];
        break;
      }
    }
    if (elForPath !== undefined) return elForPath;
    else throw new Error("invalid link but couldn't match a fallback element for the current path=" + matches[matches.length - 1]?.pathname);
  }
}
