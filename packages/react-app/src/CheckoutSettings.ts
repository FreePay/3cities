import { ProposedPayment } from "./Payment";
import { StrategyPreferences } from "./StrategyPreferences";

// SenderNoteSettings describes whether the sender/buyer may optionally
// or must provide a note to the receiver/seller.
export type SenderNoteSettings = Readonly<{
  mode: 'NONE';
  instructions?: never;
} | {
  mode: 'OPTIONAL'; // NB these modes values are uppercase to match protobuf generated values, enabling direct assignment from typescript to protobuf enum
  instructions?: string;
} | {
  mode: 'REQUIRED';
  instructions?: string;
}>

// CheckoutSettings is a top-level object that describes the shape of
// one or more independent checkouts that may occur. Typically, a
// seller/receiver configures these settings, and then sends these
// settings serialized in a link to buyer/receiver(s), and then the
// buyer/receiver(s) may complete one or more independent checkouts
// based on these settings.
export type CheckoutSettings = Readonly<{
  proposedPayment: ProposedPayment; // payment being proposed in this checkout
  receiverStrategyPreferences: StrategyPreferences; // receiver/seller's payment strategy preferences
  note?: string; // human-readable note describing or contextualizing this checkout, intended to be read by the buyer/sender, eg. "thanks for lunch"
  senderNoteSettings: SenderNoteSettings; // whether the sender/buyer may optionally or must provide a note to the receiver/seller
  successRedirect?: {
    url: string; // url to redirect to after successful checkout
    openInNewTab: boolean; // the redirect will open in a new tab iff this is set
    callToAction?: string; // human-readable call to action to prompt the sender/buyer to click a button to trigger the success redirect, as redirects must be triggered by user actions or be suppressed by the browser as spam. Example: "Let Joe know you paid"
  }
  webhookUrl?: string; // webhook url to call when checkout events occur, eg. on checkout success
}>

// CheckoutOutcomeBase is a shared base type to centralize data common
// to all checkout outcomes.
type CheckoutOutcomeBase = Readonly<{
  checkoutSettings: CheckoutSettings; // the checkout settings for the checkout that resulted in this outcome
  senderProvidedInfo: Readonly<{
    note?: string; // note provided by the sender/buyer. WARNING checkoutSettings.senderNoteMode determines whether or not this note may optionally or must have been provided, but there's no typesafety between senderNoteMode and this field, so the illegal state is representable where this note could be exist even though senderNoteMode.mode === 'none'
  }>;
}>

// CheckoutSuccess a checkout outcome indicating the sender/buyer has
// successfully completed a checkout.
export type CheckoutSuccess = CheckoutOutcomeBase & Readonly<{
  // TODO the Payment from which transactions were formed and executed(eg.if the buyer paid a suggested amount, this would be the synthetic payment for the suggested amount the buyer selected)
  // TODO SuccessData/(transaction id, chain id)[] executed to settle the payment
  //  TODO the chosen Strategy to settle the payment from which the transactions were formed
}>
