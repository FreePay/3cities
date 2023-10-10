import React from "react";
import { Checkout } from "./checkout";

export const CheckoutSettingsContext = React.createContext<Checkout | undefined>(undefined); // the contextual CheckoutSettings. See CheckoutSettingsProvider. WARNING this context must only be provided by CheckoutSettingsProvider and used by useCheckoutSettings
