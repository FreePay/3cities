import { useContext } from "react";
import { CheckoutSettingsContext } from "./CheckoutSettingsContext";
import { CheckoutSettings } from "./CheckoutSettings";

// useCheckoutSettings returns the contextual CheckoutSettings that's
// been provided by CheckoutSettingsProvider, or throws an error if
// useCheckoutSettings is used in a component that isn't a descendant of
// CheckoutSettingsProvider.
export function useCheckoutSettings(): CheckoutSettings {
  const cs = useContext(CheckoutSettingsContext);
  if (!cs) throw new Error("useCheckoutSettings must be used within a descendant of CheckoutSettingsProvider");
  else return cs;
}
