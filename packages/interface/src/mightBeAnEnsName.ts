
// mightBeAnEnsName returns true iff the passed maybeEnsName is detected
// as possibly an ENS name, otherwise false if maybeEnsName is
// definitely not an ENS name. Ie. iff mightBeAnEnsName returns true,
// further analysis is required to determine if it's actually an ENS
// name (eg. by attempting resolution). mightBeAnEnsName allows clients
// to quickly determine if something is definitely not an ENS name.
export function mightBeAnEnsName(maybeEnsName: string | undefined): boolean {
  if (maybeEnsName === undefined) return false;
  else if (maybeEnsName.includes('.')) return true; // if it has a dot, it might be an ENS name, because all ENS names have at least one dot
  else return false;
}
