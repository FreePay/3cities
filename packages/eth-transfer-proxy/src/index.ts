import { ETHTransferProxyABI } from './abi.gen';

export { ETHTransferProxyABI };

type ContractAddressByChainId = {
  readonly [chainId: number]: {
    readonly name: string;
    readonly contractAddress: `0x${string}`;
  };
};

/**
 * ETHTransferProxyContractAddresses provides access to the contract
 * addresses for ETHTransferProxy on supported chains.
 */
export const ETHTransferProxyContractAddresses = {
  11_155_111: { name: "Sepolia", contractAddress: "0x374f328ba653bc43e42cbeb41e4f8cf2647edb6e", },
  300: { name: "zkSync Sepolia", contractAddress: "0x35626B9C13D0D72C4153026C9A8581d3991C5C6e", },
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
