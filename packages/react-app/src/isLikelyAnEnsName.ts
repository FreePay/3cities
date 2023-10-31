
// isLikelyAnEnsName returns true iff the passed maybeEnsName is
// detected as likely to be an ENS name. WARNING both false positive and
// false negatives can occur, and so isLikelyAnEnsName is only suitable
// for optimistic detection and not for verification.
export function isLikelyAnEnsName(maybeEnsName: string | undefined): boolean {
  if (maybeEnsName === undefined) return false;
  else {
    const l = maybeEnsName.toLowerCase();
    return l.endsWith('.eth')
      || l.endsWith('.cb.id') // Coinbase's ENS namespace. Every Coinbase Wallet user automatically has one of these names
      ;
  }
}
