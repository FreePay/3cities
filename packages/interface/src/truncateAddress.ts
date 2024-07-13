// from https://github.com/family/connectkit/blob/main/packages/connectkit/src/utils/index.ts

const truncateRegex = /^(0x[a-zA-Z0-9]{5})[a-zA-Z0-9]+([a-zA-Z0-9]{5})$/;

const truncateVeryShortRegex = /^(0x[a-zA-Z0-9]{3})[a-zA-Z0-9]+([a-zA-Z0-9]{3})$/;

export const truncateEthAddressVeryShort = truncateEthAddressInternal.bind(null, truncateVeryShortRegex);

// truncateEthAddress truncates the passed Ethereum address.
export const truncateEthAddress = truncateEthAddressInternal.bind(null, truncateRegex);

function truncateEthAddressInternal(regex: RegExp, address?: `0x${string}`, separator: string = '••'): string {
  if (!address) return '';
  else {
    const match = address.match(regex);
    if (!match) return address;
    else return `${match[1]}${separator}${match[2]}`;
  }
}

// truncateEnsName truncates the passed ens name to be no longer than
// the passed maxLength.
export const truncateEnsName = (ensName: string | undefined, maxLength: number = 18): string => { // here we default to 18 chars before truncating an ENS name, whereas by default, truncated eth addresses are only 14 chars long. We allow the longer 18 chars for ens names because (i) showing more ens name content tends to be more meaningful than a few extra chars of an address, and (ii) often, alphabetical chars in an ens name are narrower than hex chars in an address, so the render width of 18 ens name chars can often be similar to 14 for an address
  if (!ensName) return '';
  else if (ensName.length > maxLength) return ensName.replace('.eth', '').slice(0, maxLength) + '...';
  else return ensName;
};
