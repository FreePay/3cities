import { Chain } from "wagmi";
import { NonEmptyArray } from "./NonEmptyArray";
import { Web3AuthConnector, Web3AuthLoginProvider } from "./Web3AuthConnector";

// makeWeb3AuthConnectorAsync is the recommended entry point for
// clients to build a Web3AuthConnector in an async fashion and
// automatically provides code splitting for the Web3Auth
// dependencies.
export async function makeWeb3AuthConnectorAsync(chains: NonEmptyArray<Chain>, loginProvider: Web3AuthLoginProvider): Promise<Web3AuthConnector> {
  const m = await import('./makeWeb3AuthConnector');
  return m.makeWeb3AuthConnector(chains, loginProvider);
}
