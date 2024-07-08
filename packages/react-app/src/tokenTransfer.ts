import { AddressOrEnsName } from "./AddressOrEnsName";
import { Narrow } from "./Narrow";
import { PartialFor } from "./PartialFor";
import { NativeCurrency, Token, isToken } from "./Token";

// TokenTransfer represents a single token transfer of a native currency
// or token from a sender to a receiver. The TokenTransferBase base type
// is used because unless TokenTransfer is explicitly defined as the sum
// TokenTransferForToken | TokenTransferForNativeCurrency, TypeScript
// can't infer that `const tt: TokenTransfer satisfies
// (TokenTransferForToken | TokenTransferForNativeCurrency)` which is
// desirable to, among other things, pass a TokenTransfer to
// isTokenAndNotNativeCurrencyTransfer and have the client output be a
// local variable of type TokenTransferForToken else
// TokenTransferForNativeCurrency.
type TokenTransferBase = Readonly<{
  receiverAddress: `0x${string}`; // address receiving this token transfer
  senderAddress: `0x${string}`; // address sending this token transfer
  token: NativeCurrency | Token; // token or native currency being transferred
  amount: bigint; // amount of the transfer in full-precision units of the token (ie. the amount expressed in minimal units of the token based on its number of decimals, eg. wei for ETH, 10^-18 dollars for DAI, 10^-6 dollars for USDC, etc.)
}>;

export type TokenTransferForToken = Narrow<TokenTransferBase, 'token', Token>; // TokenTransferForToken is a convenience type for the subset of TokenTransfers where a token (and not a native currency) is being transferred. But where possible, clients should prefer using TokenTransfer to abstract over the type of transfer

export type TokenTransferForNativeCurrency = Narrow<TokenTransferBase, 'token', NativeCurrency>; // TokenTransferForNativeCurrency is a convenience type for the subset of TokenTransfers where a native currency (and not a token) is being transferred. But where possible, clients should prefer using TokenTransfer to abstract over the type of transfer

export type TokenTransfer = TokenTransferForToken | TokenTransferForNativeCurrency;

export function isTokenAndNotNativeCurrencyTransfer(tt: TokenTransfer): tt is TokenTransferForToken {
  return isToken(tt.token);
}

// ProposedTokenTransfer is a token transfer to a specified receiver
// that may be proposed to a sender who is not yet specified. The
// proposed token transfer may include unresolved details that must be
// resolved for the proposal to be "accepted" and "promoted" into a
// (non-proposal) token transfer.
export type ProposedTokenTransfer = Readonly<PartialFor<
  Omit<TokenTransfer, 'receiverAddress'>,
  'senderAddress'> & { // ProposedTokenTransfer allows the sender's address to be not yet specified because we define a proposed token transfer as a proposal to transfer tokens to a receiver before the sender may be known
    receiver: AddressOrEnsName; // ProposedTokenTransfer allows the payment receiver to be specified as an ENS name or an address. The ENS name must be resolved into an address before the ProposedTokenTransfer can become a TokenTransfer
  }>;

export function isTokenTransfer(tt: TokenTransfer | ProposedTokenTransfer): tt is TokenTransfer {
  return 'receiverAddress' in tt;
}
