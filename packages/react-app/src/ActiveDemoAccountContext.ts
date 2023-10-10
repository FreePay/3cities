import React from "react";

// ActiveDemoAccountContext is set to the currently active demo account
// managed via DemoAccountProvider, or undefined if no demo account is
// active. (ie. a demo account is a read-only impersonated connected
// wallet for demo purposes).
export const ActiveDemoAccountContext = React.createContext<string | undefined>(undefined);
