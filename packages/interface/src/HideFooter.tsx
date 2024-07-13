import React from "react";
import { Outlet } from "react-router-dom";

// TODO HideFooter could eventually be deprecated in favor of adding props like `hideFooterOnMobile: boolean` directly to MainWrapperProps. Then, we'd simply multiplex MainWrapper in Routes based on the unique sets of props needed. Eg. if we end up needing three different unique combinations of MainWrapper props, then MainWrapper would be used in three places in Routes. This is similar to how MainWrapper is already used twice in Routes, once normally and once as the child of HideFooterOnMobile.

// HideFooterOnMobileContext allows an ancestor component to specify
// that the page's footer should be hidden on mobile. Typically,
// HideFooterOnMobileContext would be provided `true` near the root of
// the route hierarchy, and then the Footer consumes this context to
// know it should hide itself.
export const HideFooterOnMobileContext = React.createContext(false);

export const HideFooterOnMobile: React.FC = () => {
  return <HideFooterOnMobileContext.Provider value={true}>
    <Outlet />
  </HideFooterOnMobileContext.Provider>;
}
