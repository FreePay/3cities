
// isLikelyAnEnsName returns true iff the passed maybeEnsName is
// detected as likely to be an ENS name. WARNING both false positive and
// false negatives can occur, and so isLikelyAnEnsName is only suitable
// for optimistic detection and not for verification.
export function isLikelyAnEnsName(maybeEnsName: string | undefined): boolean {
  return maybeEnsName !== undefined && maybeEnsName.toLowerCase().endsWith('.eth');
}
