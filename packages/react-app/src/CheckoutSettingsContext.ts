import React from "react";
import { CheckoutSettings } from "./CheckoutSettings";

export const CheckoutSettingsContext = React.createContext<CheckoutSettings | undefined>(undefined); // the global contextual CheckoutSettings. See CheckoutSettingsProvider. WARNING this context must only be provided by CheckoutSettingsProvider and used by useCheckoutSettings, and not directly consumed by anything else
