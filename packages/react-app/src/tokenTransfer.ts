import { Narrow } from "./Narrow";
import { NativeCurrency, Token } from "./Token";

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
type TokenTransferBase = {
  toAddress: string; // address receiving this token transfer
  fromAddress: string; // address sending this token transfer
  token: NativeCurrency | Token; // token or native currency being transferred
  amountAsBigNumberHexString: string; // amount of the transfer in full-precision units of the token (ie. the amount expressed in minimal units of the token based on its number of decimals, eg. wei for ETH, 10^-18 dollars for DAI, 10^-6 dollars for USDC, etc.) as a BigNumber.toHexString()
};

export type TokenTransferForToken = Narrow<TokenTransferBase, 'token', Token>; // TokenTransferForToken is a convenience type for the subset of TokenTransfers where a token (and not a native currency) is being transferred. But where possible, clients should prefer using TokenTransfer to abstract over the type of transfer

export type TokenTransferForNativeCurrency = Narrow<TokenTransferBase, 'token', NativeCurrency>; // TokenTransferForNativeCurrency is a convenience type for the subset of TokenTransfers where a native currency (and not a token) is being transferred. But where possible, clients should prefer using TokenTransfer to abstract over the type of transfer

export type TokenTransfer = TokenTransferForToken | TokenTransferForNativeCurrency;

export function isTokenAndNotNativeCurrencyTransfer(tt: TokenTransfer): tt is TokenTransferForToken {
  return Object.prototype.hasOwnProperty.call(tt.token, "contractAddress");
}
