import { getChain, type Chain } from "./chains";

export function getBlockExplorerUrlForTransaction(chainId: number | undefined, transactionHash: string): string | undefined {
  const chain: Chain | undefined = getChain(chainId);
  const blockExplorerUrl: string | undefined = getBlockExplorerUrl(chain);
  if (blockExplorerUrl) {
    return `${ensureUrlEndsWithSlash(blockExplorerUrl)}tx/${transactionHash}`;
  } else return undefined;
}

export function getBlockExplorerUrlForAddress(chainId: number | undefined, address: `0x${string}`): string | undefined {
  const chain: Chain | undefined = getChain(chainId);
  const blockExplorerUrl: string | undefined = getBlockExplorerUrl(chain);
  if (blockExplorerUrl) {
    return `${ensureUrlEndsWithSlash(blockExplorerUrl)}address/${address}`;
  } else return undefined;
}

function getBlockExplorerUrl(chain: Chain | undefined): string | undefined {
  const blockExplorerUrl: string | undefined = chain?.blockExplorers?.default.url;
  return blockExplorerUrl;
}

function ensureUrlEndsWithSlash(url: string): string {
  if (url.endsWith('/')) return url;
  else return url + '/';
}
