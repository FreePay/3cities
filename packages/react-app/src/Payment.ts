import { Narrow } from "./Narrow";
import { PartialFor } from "./PartialFor";
import { LogicalAssetTicker } from "./logicalAssets";

// PayWhatYouWant is a payment mode that allows the sender/buyer to pay
// what they want to settle a payment. For example, a donation can be
// thought of as a payment where the buyer/donator gets to pick the
// amount they pay.
type PayWhatYouWant = Readonly<{
  isDynamicPricingEnabled: boolean; // iff true, 3cities may suggest different amounts to pay to a sender/buyer based on contextual factors, such as the contents of a sender/buyer's connected account. TODO support isDynamicPricingEnabled
  canPayAnyAsset: boolean; // iff true, the sender/buyer may settle the payment by paying any token, instead of only tokens denominated in the payment's specified logical asset. TODO support canPayAnyAsset
  suggestedLogicalAssetAmountsAsBigNumberHexStrings: string[]; // payment amounts which 3cities may suggest to the sender/buyer as options to settle the payment. For example, donation amounts to suggest. TODO support suggestedLogicalAssetAmountsAsBigNumberHexStrings
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

// Payment is a logical payment from a sender to a receiver. This
// payment exists only at the "logical" level because it specifies only
// the shape of what the sender may pay the receiver, it doesn't specify
// which tokens or chains may end up being involved in the payment.
export type Payment = Readonly<{
  receiverAddress: `0x${string}`;
  senderAddress: `0x${string}`;
  logicalAssetTicker: LogicalAssetTicker; // the ticker for the logical asset that the reciever will receive when this payment is settled. However, iff paymentMode.payWhatYouWant?.canPayAnyAsset, then this logical asset may be ignored as the sender may then optionally settle the payment by paying any asset.
  paymentMode: PaymentMode;
}>

// PaymentWithFixedAmount is a Payment that's been narrowed to require
// its payment mode to be a fixed amount (and not permit "pay what you
// want" mode).
export type PaymentWithFixedAmount = Narrow<Payment, 'paymentMode', { logicalAssetAmountAsBigNumberHexString: string }>;

export function isPaymentWithFixedAmount(p: Payment): p is PaymentWithFixedAmount {
  return p.paymentMode.logicalAssetAmountAsBigNumberHexString !== undefined;
}

// AddressOrEnsName models a conceptual address as either a concrete
// address xor ens name. Ie. AddressOrEnsName is the sum type of an
// Ethereum address or an ens name which may or may not be successfully
// resolvable into an Ethereum address. 
export type AddressOrEnsName = Readonly<{
  ensName: string;
  address?: never;
} | {
  ensName?: never;
  address: `0x${string}`;
}>

// ProposedPayment is a payment to a specified receiver that may be
// proposed to a sender who may not yet be specified. The proposed
// payment may include unresolved details that must be resolved for the
// proposal to be "accepted" and "promoted" into a (non-proposal)
// payment.
export type ProposedPayment = Readonly<PartialFor<
  Omit<Payment, 'receiverAddress'>,
  'senderAddress'> & { // ProposedPayment allows the sender's address to be not yet specified because in our model of payments, every payment has exactly one sender and one receiver, and we define a proposed payment as a proposal to pay a receiver before the sender may be known
    receiver: AddressOrEnsName; // ProposedPayment allows the payment receiver to be specified as an ENS name or an address. The ENS name must be resolved into an address before the ProposedPayment can become a Payment
  }>;

export function isPayment(p: Payment | ProposedPayment): p is Payment {
  return 'receiverAddress' in p;
}

// ProposedPaymentWithFixedAmount is a ProposedPayment that's been
// narrowed to require its payment mode to be a fixed amount (and not
// permit "pay what you want" mode).
export type ProposedPaymentWithFixedAmount = Narrow<ProposedPayment, 'paymentMode', { logicalAssetAmountAsBigNumberHexString: string }>;

export function isProposedPaymentWithFixedAmount(p: ProposedPayment): p is ProposedPaymentWithFixedAmount {
  return p.paymentMode.logicalAssetAmountAsBigNumberHexString !== undefined;
}

// ProposedPaymentWithReceiverAddress is a ProposedPayment that's been
// narrowed to require a receiver address (and not permit a receiver ENS
// name)
export type ProposedPaymentWithReceiverAddress = Narrow<ProposedPayment, 'receiver', { address: `0x${string}` }>;

export function isProposedPaymentWithReceiverAddress(pp: ProposedPayment): pp is ProposedPaymentWithReceiverAddress {
  return pp.receiver.address !== undefined;
}

export function acceptProposedPayment(senderAddress: `0x${string}`, pp: ProposedPaymentWithReceiverAddress): Payment {
  const p: Payment = {
    receiverAddress: pp.receiver.address,
    senderAddress,
    logicalAssetTicker: pp.logicalAssetTicker,
    paymentMode: pp.paymentMode,
  };
  return p;
}
