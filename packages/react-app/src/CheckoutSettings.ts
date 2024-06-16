import { ExchangeRates } from "./ExchangeRates";
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

// Success action to redirect upon successful checkout.
export type SuccessActionRedirect = Readonly<{
  url: string; // url to redirect to upon successful checkout
  openInNewTab: boolean; // the redirect will open in a new tab iff this is set
  callToAction?: string; // human-readable call to action to prompt the sender/buyer to click a button to trigger the success redirect, as redirects must be triggered by user actions or be suppressed by the browser as spam. Example: "Let Joe know you paid"
}>

// Success action to close the 3cities window upon successful checkout.
export type SuccessActionCloseWindow = Readonly<{
  ifStandaloneWindow: Readonly<{ // config to close window upon successful checkout when the 3cities window is a standalone window
    callToAction?: string; // human-readable call to action to prompt the sender/buyer to close the 3cities window. The 3cities window must be closed manually by the sender/buyer because, for security and spam reasons, the browser enforces that scripts may close only the windows that were opened by them. Ie. a stand-alone browser tab that was opened by the user having clicked a link can't be closed via scripts in that tab. Example: "Thanks for paying Joe's Shop! It's safe to close this window"
  }>;
  ifIframe: Readonly<({ // config to close window upon successful checkout when the 3cities window is an iframe. WARNING closing the 3cities iframe is implemented via iframe message passing and this requires the window.parent to handle these messages and manually close/destroy the 3cities iframe. The 3cities SDK (running in the parent window) automatically handles these messages
    autoClose: Readonly<{ // automatically close the 3cities iframe upon successful checkout
      // TODO support a configurable label to display while iframe is waiting to autoClose, eg. "You'll automatically return to Joe's shop in 3 seconds..."
      delayMilliseconds?: number; // delay in milliseconds before the 3cities iframe is automatically closed
    }>
    clickToClose?: never;
  } | {
    autoClose?: never;
    clickToClose: Readonly<{ // require the sender/buyer to click a button to close the 3cities iframe upon successful checkout
      callToAction?: string; // human-readable call to action to prompt the sender/buyer to click a button to close the 3cities iframe. Example: "Click here to return to Joe's Shop"
    }>;
  })>;
}>;

// SuccessAction represents an action take upon successful checkout.
export type SuccessAction = Readonly<({ // action to perform upon successful checkout
  redirect: SuccessActionRedirect;
  closeWindow?: never;
} | {
  redirect?: never;
  closeWindow: SuccessActionCloseWindow;
})>;

// AuthenticateSenderAddress is a checkout setting that causes 3cities
// to ask the sender/buyer for a CAIP-222-style signature to
// authenticate their ownership of the connected wallet address prior to
// checking out. Upon successful checkout, 3cities provides this
// signature and the message that was signed to the parent window via
// the Checkout iframe message. WARNING the provided signature and
// message currently do not actually satisfy CAIP-222
// https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-222.md.
// TODO also provide signature and message in webhooks and redirect URL
// params
export type AuthenticateSenderAddress = Readonly<{
  verifyEip1271Signature?: true, // iff true, 3cities will attempt to detect if the authenticated sender address is a smart contract wallet. If it is, 3cities will verify the eip1271 signature by requiring an onchain isValidSignature call to return true before allowing the checkout to proceed. NB this clientside call to isValidSignature is insecure from the standpoint of any serverside verification done later by the client (3cities has no servers). However, in practice, verifying eip1271 signatures before allowing a checkout to proceed can help prevent a sender/buyer from paying with a wallet whose authenticating signature can't later be verified by a client's server. If user's connected address is a counterfactually instantiated smart contract wallet, then it'll appear to be an EOA to 3cities during checkout, and this verification will be skipped. However, the smart wallet must be instantiated to complete payment, after which the eip1271 signature may be verified by a client's server --> TODO support this
  // TODO consider an option to let the client control if the signature is iframe postMessage'd by itself before checkout, and/or upon successful checkout with and/or without transaction details
}>;

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
  successAction?: SuccessAction; // action to perform upon successful checkout
  webhookUrl?: string; // webhook url to call when checkout events occur, eg. on checkout success
  mode?: "deposit"; // TODO WARNING reconsider the internal structure of `mode`. What should its type be? Today, we don't support mode in serialization, only in the domain using URL param overrides. Instead, mode should be supported at the data layer, with "pay" mode being the default, as well as other modes, such as tip, donate, transfer, and receive
  requireInIframeOrErrorWith?: string; // iff defined, the 3cities window must be an iframe with a defined window.parent otherwise checkout may not proceed and `requireInIframeOrErrorWith` will be displayed to the user as an error message. This prevents the checkout from occurring in a standalone window when client recognition of that checkout depends on iframe message passing
  iframeParentWindowOrigin?: string; // if defined and 3cities is running in an iframe, then messages sent by 3cities to the parent window require that the parent window's origin match iframeParentWindowOrigin (or the messages will not be dispatched by window.postMessage). WARNING if iframeParentWindowOrigin is undefined and 3cities is running in an iframe, then 3cities will set postMessage targetOrigin to '*' which can be a security risk. https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#targetorigin
  authenticateSenderAddress?: AuthenticateSenderAddress; // iff defined, 3cities will require the sender/buyer to sign a message proving ownership of their address prior to checking out. When running in an iframe, the signature is provided to the client via iframe message passing upon sucessful checkout. Clients may use this signature to securely associate an onchain transaction with the client's view of the checkout
  nativeTokenTransferProxy: 'never' | 'prefer' | 'require'; // 3cities supports automatic use of a built-in proxy that emits an ERC20-compliant Transfer event for a native token transfer. This proxy exists because generalized offchain detection of ETH transfers (eg. when using smart contract wallets) can't be done using the ethrpc api, and can only be done with non-standard tracing APIs. This checkout can automatically route its native token transfers (if any) through our built-in proxy, such that the transfers are detectable by monitoring for Transfer events. Our built-in proxy is a stateless hyperstructure that never has custody of funds and simply forwards any ETH sent to the specified recipient and emits a Transfer event, using about 50% more gas than a standard ETH transfer. A permament solution to this problem has been proposed via EIP-7708: ETH transfers emit a log. If set to 'never', this proxy will never be used and any native token transfers will occur ordinarily (standard ETH transfer). If 'prefer', the proxy will be used if it's available on the chain where the native token transfer is being executed. If 'require', the proxy must be used and native token transfers attempted on chains where the proxy is unavailable will result in an error status.
  exchangeRates?: ExchangeRates; // iff defined, 3cities will merge these exchange rates with 3cities's own internally calculated exchange rates, prioritizing these rates over the internal rates (ie. these rates are overrides). Note that 3cities has its own internal exchange rates engine and defining rates here is not required to enjoy automatic multi-currency payments. WARNING before passing any overrides, take a look at internal exchange rates data and algorithms to anticipate any potentially negative interactions.
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
