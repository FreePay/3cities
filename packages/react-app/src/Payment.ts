import { AddressOrEnsName } from "./AddressOrEnsName";
import { Narrow } from "./Narrow";
import { PartialFor } from "./PartialFor";
import { PrimaryWithSecondaries } from "./PrimaryWithSecondaries";
import { LogicalAssetTicker } from "./logicalAssets";

// TODO consider adding an TokenAmount(token: NativeCurrency | Token, amount: bigint) and LogicalAssetAmount(lat: LogicalAssetTicker, amount: bigint) for contexts where the amount should be coupled to its token, with eg. helper functions to convert amounts to other tokens/logical assets given exchange rates, or add/subtract amounts if they share a token/lat --> in some contexts, coupling the token to its amount can lead to undesirable or representable illegal states, such as in Payment where we want to separate the amount from the logical asset because "pay what you want" mode doesn't have a fixed amount. But in many other cases, combining the token/lat with its amount can lead to safer code because the amount is never detached from its token/decimals --> NB for these abstractions to be compatible with eventually supporting arbitrary tokens beyond our manifest of supported tokens, perhaps they should include the Token/NativeCurrency objects directly instead of their tickers, which prevents having to map the ticker to the Token using the global manifest, which is impossible when the Token was dynamically constructed from tokenlist, eg. user has UNI in their wallet.
// TODO we also need much better and safer logical asset/token/native currency conversion facilities. Today, the ExchangeRates's convert will apply an exchange rate, but ignores decimals. We need type-safe amounts whose types and conversion facilities come from the modules to which they are related. For example, types and facilities to convert between logical asset amounts should be in logicalAssets.ts. Types and facilities to convert tokens/native currencies and logical assets that support them should be in logicalAssetsToTokens.ts. Types and facilities to convert between different tokens/native currencies/logical assets should be in exchange rates. No API should ever return an answer that needs further processing to become sensical. Eg. you should be able to pass convert a USDC amount and ask it to convert it to an ETH amount, and it should handle the conversion rate as well as the decimals. Btw, ETH is the only logical asset that's also a native currency, so that's another reason it's good for logical assets to use 18 decimals: it makes logical ETH amounts equivalent to ETH native currency amounts, supporting these APIs.

// PayWhatYouWant is a payment mode that allows the sender/buyer to pay
// what they want to settle a payment. For example, a donation can be
// thought of as a payment where the buyer/donator gets to pick the
// amount they pay.
export type PayWhatYouWant = Readonly<{
  isDynamicPricingEnabled: boolean; // iff true, 3cities may suggest different amounts to pay to a sender/buyer based on contextual factors, such as the contents of a sender/buyer's connected account
  canPayAnyAsset: boolean; // iff true, the sender/buyer may settle the payment by paying any token, instead of only tokens denominated in the payment's specified logical asset. TODO support canPayAnyAsset
  suggestedLogicalAssetAmountsAsBigNumberHexStrings: string[]; // payment amounts which 3cities may suggest to the sender/buyer as options to settle the payment. For example, donation amounts to suggest
}>

// PaymentMode represents the different ways in which a Payment may be
// settled by one or more transactions. Currently, we support two modes:
// "pay fixed amount" mode and "pay what you want" mode.
export type PaymentMode = Readonly<{
  logicalAssetAmountAsBigNumberHexString: string; // we refer to this payment mode as "pay fixed amount mode" even though it's a single field and not a product type. We considered making this into a product type PayFixedAmount, but I couldn't think of any new fields that may likely go in the product type, and the cost of adding PayFixedAmount is that every generated link with a fixed amount becomes a couple chars longer because of the new proto submessage PayFixedAmount. We have examples to support eg. minimum payment amounts, etc, but currently have no plans to soon support these complex logical amounts. So that's why we went with a single field for "pay fixed amount mode"
  payWhatYouWant?: never;
} | {
  logicalAssetAmountAsBigNumberHexString?: never;
  payWhatYouWant: PayWhatYouWant;
}>;

export function isPaymentModeWithFixedAmount(pm: PaymentMode): pm is { logicalAssetAmountAsBigNumberHexString: string; } {
  return Object.prototype.hasOwnProperty.call(pm, "logicalAssetAmountAsBigNumberHexString");
}

// PaymentBase is a logical payment from a sender to a receiver. This
// payment exists only at the "logical" level because it specifies only
// the shape of what the sender may pay the receiver, it doesn't specify
// which tokens or chains may end up being involved in the payment. The
// PaymentBase base type is used because unless Payment is explicitly
// defined as the sum PaymentWithFixedAmount |
// PaymentWithPayWhatYouWant, TypeScript can't infer that `const tt:
// Payment satisfies (PaymentWithFixedAmount |
// PaymentWithPayWhatYouWant)` which is desirable to, among other
// things, pass a Payment to isPaymentWithFixedAmount and have the
// client output be a local variable of type PaymentWithFixedAmount else
// PaymentWithPayWhatYouWant.
type PaymentBase = Readonly<{
  receiverAddress: `0x${string}`;
  senderAddress: `0x${string}`;
  logicalAssetTickers: PrimaryWithSecondaries<LogicalAssetTicker>; // the tickers for the logical assets, one or more of which the receiver will receive upon settlement of this payment. `primary` is the logical asset ticker in which this payment is denominated, and any `secondaries` are prioritized logical asset tickers that are also accepted for payment (secondaries[i] is higher priority than secondaries[i+1]). However, iff paymentMode.payWhatYouWant?.canPayAnyAsset, then these logical assets may be ignored as the sender may then optionally settle the payment by paying any asset.
  paymentMode: PaymentMode;
}>

// PaymentWithFixedAmount is a Payment that's been narrowed to require
// its payment mode to be a fixed amount (and not permit "pay what you
// want" mode).
export type PaymentWithFixedAmount = Narrow<PaymentBase, 'paymentMode', { logicalAssetAmountAsBigNumberHexString: string }>;

// PaymentWithPayWhatYouWant is a Payment that's been narrowed to
// require its payment mode to be pay what you want (and not permit a
// fixed amount).
export type PaymentWithPayWhatYouWant = Narrow<PaymentBase, 'paymentMode', { payWhatYouWant: PayWhatYouWant; }>;

export type Payment = PaymentWithFixedAmount | PaymentWithPayWhatYouWant;

export function isPaymentWithFixedAmount(p: Payment): p is PaymentWithFixedAmount {
  return Object.prototype.hasOwnProperty.call(p.paymentMode, "logicalAssetAmountAsBigNumberHexString");
}

// ProposedPayment is a payment to a specified receiver that may be
// proposed to a sender who may not yet be specified. The proposed
// payment may include unresolved details that must be resolved for the
// proposal to be "accepted" and "promoted" into a (non-proposal)
// payment. The ProposedPaymentBase base type is used because unless
// ProposedPayment is explicitly defined as the sum
// ProposedPaymentWithFixedAmount | ProposedPaymentWithPayWhatYouWant,
// TypeScript can't infer that `const tt: ProposedPayment satisfies
// (ProposedPaymentWithFixedAmount | ProposedPaymentWithPayWhatYouWant)`
// which is desirable to, among other things, pass a ProposedPayment to
// isProposedPaymentWithFixedAmount and have the client output be a
// local variable of type ProposedPaymentWithFixedAmount else
// ProposedPaymentWithPayWhatYouWant.
type ProposedPaymentBase = Readonly<PartialFor<
  Omit<PaymentBase, 'receiverAddress'>,
  'senderAddress'> & { // ProposedPayment allows the sender's address to be not yet specified because in our model of payments, every payment has exactly one sender and one receiver, and we define a proposed payment as a proposal to pay a receiver before the sender may be known
    receiver: AddressOrEnsName; // ProposedPayment allows the payment receiver to be specified as an ENS name or an address. The ENS name must be resolved into an address before the ProposedPayment can become a Payment
  }>;

// ProposedPaymentWithFixedAmount is a ProposedPayment that's been
// narrowed to require its payment mode to be a fixed amount (and not
// permit "pay what you want" mode).
export type ProposedPaymentWithFixedAmount = Narrow<ProposedPaymentBase, 'paymentMode', { logicalAssetAmountAsBigNumberHexString: string; }>;

// ProposedPaymentWithPayWhatYouWant is a ProposedPayment that's been
// narrowed to require its payment mode to be pay what you want (and not
// permit a fixed amount).
export type ProposedPaymentWithPayWhatYouWant = Narrow<ProposedPaymentBase, 'paymentMode', { payWhatYouWant: PayWhatYouWant; }>;

export type ProposedPayment = ProposedPaymentWithFixedAmount | ProposedPaymentWithPayWhatYouWant;

export function isPayment(p: Payment | ProposedPayment): p is Payment {
  return 'receiverAddress' in p;
}

export function isProposedPaymentWithFixedAmount(p: ProposedPayment): p is ProposedPaymentWithFixedAmount {
  return Object.prototype.hasOwnProperty.call(p.paymentMode, "logicalAssetAmountAsBigNumberHexString");
}

// ProposedPaymentWithReceiverAddress is a ProposedPayment that's been
// narrowed to require a receiver address (and not permit a receiver ENS
// name)
export type ProposedPaymentWithReceiverAddress = Narrow<ProposedPayment, 'receiver', { address: `0x${string}` }>;

export function isProposedPaymentWithReceiverAddress(pp: ProposedPayment): pp is ProposedPaymentWithReceiverAddress {
  return pp.receiver.address !== undefined;
}

export function acceptProposedPayment(senderAddress: `0x${string}`, pp: ProposedPaymentWithReceiverAddress): Payment {
  // The following curious block of code is needed because until the type guard isProposedPaymentWithFixedAmount is executed, TypeScript can't infer that `pp.paymentMode` is assignable to Payment.paymentMode:
  if (isProposedPaymentWithFixedAmount(pp)) return {
    receiverAddress: pp.receiver.address,
    senderAddress,
    logicalAssetTickers: pp.logicalAssetTickers,
    paymentMode: pp.paymentMode,
  } satisfies Payment; else return {
    receiverAddress: pp.receiver.address,
    senderAddress,
    logicalAssetTickers: pp.logicalAssetTickers,
    paymentMode: pp.paymentMode,
  } satisfies Payment;
}
