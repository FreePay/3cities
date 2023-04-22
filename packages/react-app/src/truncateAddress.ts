// from https://github.com/family/connectkit/blob/main/packages/connectkit/src/utils/index.ts

const truncateRegex = /^(0x[a-zA-Z0-9]{5})[a-zA-Z0-9]+([a-zA-Z0-9]{5})$/;

// truncateEthAddress truncates the passed Ethereum address.
export const truncateEthAddress = (address?: string, separator: string = '••••') => {
  if (!address) return '';
  else {
    const match = address.match(truncateRegex);
    if (!match) return address;
    else return `${match[1]}${separator}${match[2]}`;
  }
};

// truncateENSAddress truncates the passed ENS name to be no longer than
// the passed maxLength.
export const truncateENSAddress = (ensName: string, maxLength: number) => {
  if (ensName.length > maxLength) {
    return ensName.replace('.eth', '').slice(0, maxLength) + '...';
  } else {
    return ensName;
  }
};
