import localForage from "localforage";
import { Chain } from "wagmi";
import { NonEmptyArray } from "./NonEmptyArray";
import { Web3AuthConnector, Web3AuthLoginProvider } from "./Web3AuthConnector";

const mostRecentlyUsedWeb3AuthLoginProviderStorageKey = 'web3auth-login-provider';

// makeWeb3AuthConnectorAsync is the recommended entry point for
// clients to build a Web3AuthConnector in an async fashion and
// automatically provides code splitting for the Web3Auth
// dependencies.
export async function makeWeb3AuthConnectorAsync(chains: NonEmptyArray<Chain>, loginProvider: Web3AuthLoginProvider): Promise<Web3AuthConnector> {
  const m = await import('./makeWeb3AuthConnector');
  const c = await m.makeWeb3AuthConnector(chains, loginProvider);
  localForage.setItem(mostRecentlyUsedWeb3AuthLoginProviderStorageKey, loginProvider);
  return c;
}

export async function getMostRecentlyUsedWeb3AuthLoginProvider(): Promise<Web3AuthLoginProvider | undefined> {
  const p = await localForage.getItem<Web3AuthLoginProvider>(mostRecentlyUsedWeb3AuthLoginProviderStorageKey);
  if (p === null) return undefined;
  else return p;
}

export async function clearMostRecentlyUsedWeb3AuthLoginProvider(): Promise<void> {
  return localForage.removeItem(mostRecentlyUsedWeb3AuthLoginProviderStorageKey);
}
