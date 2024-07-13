import { hasOwnPropertyOfType } from "@3cities/core";
import React from "react";
import { type CheckoutSettings } from "./CheckoutSettings";

// CheckoutSettingsRequiresPassword represents the global contextual
// CheckoutSettings requiring a password to proceed. The client should
// use setPassword to provide the password, upon which the checkout
// settings will be decrypted and provided normally.
export type CheckoutSettingsRequiresPassword = {
  requirementType:
  'needToDecrypt' // the global contextual CheckoutSettings is encrypted and needs a decryption password
  | 'needToVerifySignature'; // the global contextual CheckoutSettings is decrypted but needs a signature verification password
  setPassword: (password: string) => void;
}

export function isCheckoutSettingsRequiresPassword(c: CheckoutSettings | CheckoutSettingsRequiresPassword): c is CheckoutSettingsRequiresPassword {
  return hasOwnPropertyOfType(c, 'requirementType', 'string');
}

export const CheckoutSettingsContext = React.createContext<CheckoutSettings | CheckoutSettingsRequiresPassword | undefined>(undefined); // the global contextual CheckoutSettings. See CheckoutSettingsProvider. WARNING this context must only be provided by CheckoutSettingsProvider and used by useCheckoutSettings, and not directly consumed by anything else
