
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
