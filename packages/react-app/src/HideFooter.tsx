import React from "react";
import { Outlet } from "react-router-dom";

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
