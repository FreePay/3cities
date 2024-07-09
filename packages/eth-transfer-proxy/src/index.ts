import { ETHTransferProxyABI } from './abi.gen';

export { ETHTransferProxyABI };

type ContractAddressByChainId = {
  readonly [chainId: number]: {
    readonly name: string;
    readonly contractAddress: `0x${string}`;
  };
};

const mk = (n: string, a: `0x${string}`): ContractAddressByChainId[number] => { // mk is a convenience util to create lots of canonical contract entires with minimum spam
  return { name: n, contractAddress: a };
};

/**
 * ETHTransferProxyContractAddresses provides access to the contract
 * addresses for ETHTransferProxy on supported chains.
 */
export const ETHTransferProxyContractAddresses = {
  // **** BEGIN mainnet networks ****
  1: mk("Ethereum Mainnet", "0x374f328BA653bc43e42cbEb41e4f8cf2647Edb6e"),
  10: mk("OP Mainnet", "0x1F9Ab0430654d8d0e03D1B1c730e9e7d176ee399"), // NB the CREATE2 deployment also succeeded at the same address of 0x374f328BA653bc43e42cbEb41e4f8cf2647Edb6e, however that contract verification failed and I wasn't sure how to redrive it --> TODO use the same address once it's verified
  42_161: mk("Arbitrum One", "0x1F9Ab0430654d8d0e03D1B1c730e9e7d176ee399"), // NB the CREATE2 deployment also succeeded at the same address of 0x374f328BA653bc43e42cbEb41e4f8cf2647Edb6e, however that contract verification failed and I wasn't sure how to redrive it --> TODO use the same address once it's verified
  8453: mk("Base", "0x374f328BA653bc43e42cbEb41e4f8cf2647Edb6e"),
  534_352: mk("Scroll", "0x374f328BA653bc43e42cbEb41e4f8cf2647Edb6e"),
  59_144: mk("Linea", "0x374f328BA653bc43e42cbEb41e4f8cf2647Edb6e"),
  7777777: mk("Zora", "0x374f328BA653bc43e42cbEb41e4f8cf2647Edb6e"), // TODO verify
  1101: mk("Polygon zkEVM", "0x374f328BA653bc43e42cbEb41e4f8cf2647Edb6e"),
  81457: mk("Blast", "0x374f328BA653bc43e42cbEb41e4f8cf2647Edb6e"),
  34443: mk("Mode Mainnet", "0x374f328BA653bc43e42cbEb41e4f8cf2647Edb6e."), // TODO verify
  // **** END mainnet networks ****

  // **** BEGIN testnet networks ****
  11_155_111: mk("Sepolia", "0x374f328ba653bc43e42cbeb41e4f8cf2647edb6e"),
  300: mk("zkSync Sepolia", "0x35626B9C13D0D72C4153026C9A8581d3991C5C6e"),
  // **** END testnet networks ****
} as const satisfies ContractAddressByChainId;

/**
 * getETHTransferProxyContractAddress returns the contract address for
 * ETHTransferProxy for the passed chainId, or undefined if
 * ETHTransferProxy has not been canonically deployed on that chain.
 *
 * @param {number} chainId
 * @returns {(`0x${string}` | undefined)}
 */
export function getETHTransferProxyContractAddress(chainId: number): `0x${string}` | undefined {
  const l: ContractAddressByChainId = ETHTransferProxyContractAddresses;
  return l[chainId]?.contractAddress;
}
