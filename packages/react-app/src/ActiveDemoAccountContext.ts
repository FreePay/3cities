import React from "react";

// ActiveDemoAccountContext is set to the currently active demo account
// managed via DemoAccountProvider, or undefined if no demo account is
// active. (ie. a demo account is a read-only impersonated connected
// wallet for demo purposes). WARNING this context must only be provided
// by DemoAccountProvider and used by useActiveDemoAccount, and not
// directly consumed by anything else
export const ActiveDemoAccountContext = React.createContext<string | undefined>(undefined);
