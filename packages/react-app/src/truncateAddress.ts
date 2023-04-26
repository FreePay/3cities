// from https://github.com/family/connectkit/blob/main/packages/connectkit/src/utils/index.ts

const truncateRegex = /^(0x[a-zA-Z0-9]{5})[a-zA-Z0-9]+([a-zA-Z0-9]{5})$/;

const truncateVeryShortRegex = /^(0x[a-zA-Z0-9]{3})[a-zA-Z0-9]+([a-zA-Z0-9]{3})$/;

export const truncateEthAddressVeryShort = truncateEthAddressInternal.bind(null, truncateVeryShortRegex);

// truncateEthAddress truncates the passed Ethereum address.
export const truncateEthAddress = truncateEthAddressInternal.bind(null, truncateRegex);

function truncateEthAddressInternal(regex: RegExp, address?: string, separator: string = '••••'): string {
  if (!address) return '';
  else {
    const match = address.match(regex);
    if (!match) return address;
    else return `${match[1]}${separator}${match[2]}`;
  }
}

// truncateENSAddress truncates the passed ENS name to be no longer than
// the passed maxLength.
export const truncateENSAddress = (ensName: string, maxLength: number): string => {
  if (ensName.length > maxLength) {
    return ensName.replace('.eth', '').slice(0, maxLength) + '...';
  } else {
    return ensName;
  }
};
