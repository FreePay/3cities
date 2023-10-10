import { LogicalAssetTicker } from "./logicalAssets";

// TODO try to stop using internal fields _p _rpp as they are spammy and brittle. Instead, `ReceiverProposedPayment?.fromAddress: never`. Same with _unusedAgreement... find a better way.

// Agreement is an economic agreement between multiple concrete
// participants.
export type Agreement = Payment | UnusedAgreement;

export function isPayment(a: Agreement): a is Payment {
  return Object.prototype.hasOwnProperty.call(a, "_p");
}

// ProposedAgreement is a proposal between at least one concrete
// participant and at least one unspecified participant, ie. a
// ProposedAgreement is an Agreement that's incomplete because it
// hasn't yet been accepted by the counterparty(ies).
export type ProposedAgreement = ReceiverProposedPayment | ProposedUnusedAgreement;

export function isReceiverProposedPayment(pa: ProposedAgreement): pa is ReceiverProposedPayment {
  return Object.prototype.hasOwnProperty.call(pa, "_rpp");
}

// Payment is an agreement for a sender to pay a receiver an amount of
// a logical asset.
export type Payment = {
  toAddress: string; // address receiving the payment TODO support ENS
  fromAddress: string; // address sending the payment TODO support ENS
  logicalAssetTicker: LogicalAssetTicker; // logical asset ticker of the asset being paid
  amountAsBigNumberHexString: string; // logical asset amount of the payment as a BigNumber.toHexString(). WARNING this amount must be constructed using parseLogicalAssetAmount to properly respect logical asset decimal count. TODO support complex amount eg. "more than $5", "any amount", "exactly $69.420", etc.
  note?: string; // a human-readable note associated with this payment, eg. "for dinner"
  _p: true; // internal field to help match Payment types
  _rpp: false; // internal field to help match Payment types
};

// ReceiverProposedPayment is a partial Payment that's been proposed by the
// receiver, ie. it lacks a sender.
export type ReceiverProposedPayment = Omit<Payment, 'fromAddress' | '_p' | '_rpp'> & {
  _p: false; // internal field to help match ReceiverProposedPayment types
  _rpp: true; // internal field to help match ReceiverProposedPayment types
};

// acceptReceiverProposedPayment represents the counterparty
// identified by the passed fromAddress as accepting the passed
// payment proposed by the payment receiver. The result is a
// fully-formed Payment with (only) concrete counterparties.
export function acceptReceiverProposedPayment(fromAddress: string, rpp: ReceiverProposedPayment): Payment {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _rpp, _p, ...temp } = rpp;
  const p = {
    fromAddress,
    _p: true as const,
    _rpp: false as const,
    ...temp,
  };
  return p;
}

// UnusedAgreement is an agremeent that's not yet used and is a
// placeholder to exemplify the fact that Agreement is intended to be
// a sum type of different types of agreements.
export type UnusedAgreement = {
  unused: string;
  _isUnusedAgreement: true; // internal field to help match an Agreement into an UnusedAgreement
}

// ProposedUnusedAgreement is a proposed agreement that's not yet used
// and is a placeholder to exemplify the fact that ProposedAgreement
// is intended to be a sum type of different types of proposed
// agreements.
export type ProposedUnusedAgreement = Exclude<UnusedAgreement, 'unused'>;
