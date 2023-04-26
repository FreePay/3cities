import { configureChains, disconnect, getAccount } from '@wagmi/core';
import { createClient, UserRejectedRequestError } from 'wagmi'; // NB createClient exported by wagmi seems to include a built-in queryClient and is a different type than createClient exported by @wagmi/core; this createClient from 'wagmi' is recommended for a react app, to prevent us from having to construct our own queryClient
import { CoinbaseWalletConnector } from 'wagmi/connectors/coinbaseWallet';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import { alchemyProvider } from 'wagmi/providers/alchemy';
import { infuraProvider } from 'wagmi/providers/infura';
import { publicProvider } from 'wagmi/providers/public';
import { chainsSupportedBy3cities } from './chains';
import { hasOwnPropertyOfType } from './hasOwnProperty';
import { clearMostRecentlyUsedWeb3AuthLoginProvider, makeWeb3AuthConnectorAsync } from './makeWeb3AuthConnectorAsync';
import { Web3AuthConnector, Web3AuthLoginProvider } from './Web3AuthConnector';

// TODO move the web3auth async/load/set/reconnect stuff into makeWeb3AuthConnectorAsync.ts and maybe rename that file to something that explains "here's the code that glues async web3auth to wagmiClient in a lifecycle"

const alchemyApiKey: string = (() => {
  const s = process.env['REACT_APP_ALCHEMY_API_KEY'];
  if (s === undefined) {
    console.error("REACT_APP_ALCHEMY_API_KEY undefined");
    return 'REACT_APP_ALCHEMY_API_KEY_undefined';
  } else return s;
})();

const infuraApiKey: string = (() => {
  const s = process.env['REACT_APP_INFURA_API_KEY'];
  if (s === undefined) {
    console.error("REACT_APP_INFURA_API_KEY undefined");
    return 'REACT_APP_INFURA_API_KEY_undefined';
  } else return s;
})();

const walletConnectProjectId: string = (() => {
  const s = process.env['REACT_APP_WALLETCONNECT_PROJECT_ID'];
  if (s === undefined) {
    console.error("REACT_APP_WALLETCONNECT_PROJECT_ID undefined");
    return 'REACT_APP_WALLETCONNECT_PROJECT_ID_undefined';
  } else return s;
})();

const { chains, provider, webSocketProvider } = configureChains(
  chainsSupportedBy3cities,
  [
    alchemyProvider({ apiKey: alchemyApiKey, priority: 1, stallTimeout: 1000 /* millis */ }),
    infuraProvider({ apiKey: infuraApiKey, priority: 10, stallTimeout: 1000 /* millis */ }),
    publicProvider({ priority: 100, stallTimeout: 1000 /* millis */ }), // publicProvider automatically creates fallback providers for all supported networks using each network's chain.rpcUrls.default, including for networks that are unsupported by alchemy and infura. For example, zkSyncTestnet is currently unsupported by alchemy and infura and only gets connectivity from publicProvider
  ],
);

export const wagmiClient = createClient({
  autoConnect: true,
  provider,
  webSocketProvider,
  connectors: [
    // NB connectkit doesn't auto-detect Web3Auth connectors and doesn't display an option for Web3Auth, and so logging in with web3auth is not currently possible in connectkit's modal https://github.com/family/connectkit/tree/main/packages/connectkit/src/wallets/connectors --> instead, we implement lazy loading of a Web3AuthConnector below and this connector is expected to be activated outside of connectkit (eg. in our component built to activate it)
    new MetaMaskConnector({
      chains,
      options: {
        shimDisconnect: true, // here we pass true for shimDisconnect so that wagmi patches ergonomic holes in metamask (and possibly some injected wallets), or else the user may experience ergonomically poor UX, such as the user diconnects their wallet from inside the wallet browser extension, but this disconnect doesn't register with the app, so the app remains 'connected' when in fact it's disconnected.
      },
    }),
    new CoinbaseWalletConnector({
      chains,
      options: {
        appName: "3cities",
        chainId: chainsSupportedBy3cities[0].id, // this chainId is used by CoinbaseWalletSDK as some kind of fallback chainId. Here we pass the first chainId from our supported chains to ensure that whatever fallback is used in CoinbaseWalletSDK, it's actually one of our supported chains (and especially to avoid falling back to the default of mainnet when not in production)
        headlessMode: true,
      },
    }),
    new InjectedConnector({ // NB connectkit's wallet connection modal will only show InjectedConnector in the list of available wallets if there's actually a non-metamask, non-coinbase browser wallet extension, see shouldShowInjectedConnector https://github.com/family/connectkit/blob/8ac82c816c76df9154c37347c0721219d2b88a14/packages/connectkit/src/components/Pages/Connectors/index.tsx#L115 --> I was able to get Backpack.app wallet working --> connectkit detects this InjectedConnector in the wagmi.Client and also detects the Backpack browser extension, and then surfaces the wallet option "Browser Wallet" (NB phantom doesn't show up as an InjectedConnector/Browser Wallet, nor does it show up as a fake MetaMask wallet, it simply doesn't show up)
      chains,
      options: {
        shimDisconnect: true, // here we pass true for shimDisconnect so that wagmi patches ergonomic holes in metamask (and possibly some injected wallets), or else the user may experience ergonomically poor UX, such as the user diconnects their wallet from inside the wallet browser extension, but this disconnect doesn't register with the app, so the app remains 'connected' when in fact it's disconnected.
        name: (detectedName: string | string[]) =>
          `Injected (${typeof detectedName === 'string'
            ? detectedName
            : detectedName.join(', ')
          })`,
      },
    }),
    new WalletConnectConnector({
      chains,
      options: {
        projectId: walletConnectProjectId,
        showQrModal: false,
        metadata: {
          name: '3cities.xyz',
          description: '3cities is a web3 crypto payments app focused on accessibility and credible neutrality. 3cities can be used to request money, receive donations, and as a point-of-sale system for in-person payments.',
          url: 'https://3cities.xyz',
          icons: ['https://3cities.xyz/android-chrome-192x192.png'],
        }
      },
    }),
  ],
});

let web3AuthConnector: Web3AuthConnector | undefined = undefined;

// ensureWeb3AuthConnectorDestroyed ensures that any extant
// Web3AuthConnector has been disconnected and destroyed.
// postcondition: web3AuthConnector undefined and wagmiClient has no Web3AuthConnector
async function ensureWeb3AuthConnectorDestroyed(): Promise<void> {
  if (web3AuthConnector !== undefined) {
    // there's an extant Web3AuthConnector. We'll disconnect it if it's active and then destroy it
    const { connector: activeConnector } = getAccount();
    if (activeConnector && web3AuthConnector.connector.id === activeConnector.id) {
      // the extant Web3AuthConnector is active, we'll disconnect it and then destroy it
      // console.log("ensureWeb3AuthConnectorDestroyed: disconnecting active Web3AuthConnector", activeConnector);
      await disconnect();
    }
    // console.log("ensureWeb3AuthConnectorDestroyed: destroying extant Web3AuthConnector", activeConnector);
    // destroy the extant Web3AuthConnector by removing it from wagmiClient. TODO what's the recommended way to destroy a connector? https://github.com/wagmi-dev/wagmi/discussions/1822#discussioncomment-4960134
    wagmiClient.setState(s => {
      return Object.assign({}, s, {
        connectors: s.connectors.filter(c => !web3AuthConnector || c.id !== web3AuthConnector.connector.id),
      });
    });
    web3AuthConnector = undefined;
  }
}

let isLoadingMakeAndSetWeb3AuthConnector: boolean = false; // condition variable for makeAndSetWeb3AuthConnector

// makeAndSetWeb3AuthConnector constructs our singleton
// Web3AuthConnector using the passed Web3AuthLoginProvider and sets
// this newly constructed connector in our singleton wagmiClient. But
// before this construction, we'll destroy any previously-existing
// Web3AuthConnector and disconnect the user's wallet if a
// previously-existing Web3AuthConnector is the active connector.
export async function makeAndSetWeb3AuthConnector(web3AuthLoginProvider: Web3AuthLoginProvider): Promise<Web3AuthConnector> {
  if (isLoadingMakeAndSetWeb3AuthConnector) throw new Error(`unsupported call to makeAndSetWeb3AuthConnector while another invocation of makeAndSetWeb3AuthConnector was still loading`);
  isLoadingMakeAndSetWeb3AuthConnector = true;

  // 1. Destroy any extant Web3AuthConnector because wagmiClient doesn't support duplicate connectors with the same connector.id, and all Web3Auth connectors have the same id regardless of with which Web3AuthLoginProvider they are configured
  await ensureWeb3AuthConnectorDestroyed().catch(err => {
    const e = new Error(`makeAndSetWeb3AuthConnector: ensureWeb3AuthConnectorDestroyed failed: ${err}`);
    console.error(e, 'underlying error:', err);
    isLoadingMakeAndSetWeb3AuthConnector = false; // ensure isLoadingMakeAndSetWeb3AuthConnector is set to false to clear the loading state so that makeAndSetWeb3AuthConnector may be retried
    throw e; // here we must re-throw so that any clients depending on this promise receive the rejection or else, from these clients' point of view, the promise will fail silently
  });
  // console.log("connectors after ensureWeb3AuthConnectorDestroyed", wagmiClient.connectors);

  // 2. Construct our new singleton Web3AuthConnector and add it to our singleton wagmiClient
  const newConnector: Web3AuthConnector = await makeWeb3AuthConnectorAsync(chainsSupportedBy3cities, web3AuthLoginProvider).catch(err => {
    const e = new Error(`makeAndSetWeb3AuthConnector: makeWeb3AuthConnectorAsync failed: ${err}`);
    console.error(e, 'underlying error:', err);
    isLoadingMakeAndSetWeb3AuthConnector = false; // ensure isLoadingMakeAndSetWeb3AuthConnector is set to false to clear the loading state so that makeAndSetWeb3AuthConnector may be retried
    throw e; // here we must re-throw so that any clients depending on this promise receive the rejection or else, from these clients' point of view, the promise will fail silently
  });
  wagmiClient.setState(s => {
    return Object.assign({}, s, {
      connectors: [...s.connectors, newConnector.connector],
    });
  });

  web3AuthConnector = newConnector;
  // console.log("connectors after creating web3Auth", wagmiClient.connectors);
  isLoadingMakeAndSetWeb3AuthConnector = false;
  return web3AuthConnector;
}

async function tryReconnectToWeb3Auth() {
  // TODO re-enable tryReconnectToWeb3Auth which is currently commented out as we're not ready to ship web3auth integration
  // const p = await getMostRecentlyUsedWeb3AuthLoginProvider();
  // if (wagmiClient.status === 'disconnected' && p) {
  //   const connector = await (await makeAndSetWeb3AuthConnector(p)).connector;
  //   await connect({ connector, chainId: chainsSupportedBy3cities[0].id }); // here we pass a supported chainId (happens to be the 0th's chain's id, but that's unimportant) to avoid the case where the connector defaults to an unsupported chain, such as defaulting to chainId 1 when not in production
  // }
}

(async () => { // poll wagmiClient to see if we're ready to try to reconnect to web3auth. We need to attempt to reconnect manually because Web3AuthConnector is loaded async so wagmiClient can't automatically reconnect.
  let attempts = 0;
  function maybeTry() {
    // WARNING when wagmiClient boots, it goes through an async autoConnect process during which wagmiClient.status='connecting' or 'connected'. We mustn't attempt to reconnect to web3auth during that autoConnect process because wagmiClient doesn't support concurrent connection attempts. So, poll to see if wagmiClient is disconnected and try reconnecting to web3auth iff wagmiClient is disconnected within our window of poll attempts.
    if (wagmiClient.status === 'disconnected') {
      // wagmiClient has completed its autoConnect attempt, so we're ready to try and reconnect to web3auth
      tryReconnectToWeb3Auth().catch(e => {
        if (e instanceof UserRejectedRequestError && e.code === 4001) { // UserRejectedRequestError with a code of 4001 indicates the user is logged out of web3auth and a reconnection can never succeed, so we'll clear the cached login. Note we don't clear login unconditionally because the reconnect may have failed for an ephemeral reason, such as the user having no internet.
          clearMostRecentlyUsedWeb3AuthLoginProvider();
        } else console.error("error while attempting to reconnect to web3auth:", e, JSON.stringify(e), hasOwnPropertyOfType(e, 'code', 'number') && e.code);
      });
    } else if (attempts < 200) {
      // wagmiClient is still in the middle of its autoConnect attempt, so we'll try again later
      attempts++;
      setTimeout(maybeTry, 10);
    }
  }
  setTimeout(maybeTry, 10);
})();

// console.log("wagmiClient.chains", wagmiClient.chains); // WARNING wagmiClient.chains seems to be defined if and only if the wallet is currently connected. For that reason, we shouldn't rely on wagmiClient.chains to power any downstream config (eg. Web3Modal EthereumClient's chains) https://github.com/wagmi-dev/wagmi/discussions/1832
