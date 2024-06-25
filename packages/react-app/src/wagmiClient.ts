import { configureChains } from '@wagmi/core';
import { createClient } from 'wagmi'; // NB createClient exported by wagmi seems to include a built-in queryClient and is a different type than createClient exported by @wagmi/core; this createClient from 'wagmi' is recommended for a react app, to prevent us from having to construct our own queryClient
import { CoinbaseWalletConnector } from 'wagmi/connectors/coinbaseWallet';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import { alchemyProvider } from 'wagmi/providers/alchemy';
import { infuraProvider } from 'wagmi/providers/infura';
import { publicProvider } from 'wagmi/providers/public';
import { alchemyApiKey } from './alchemyApiKey';
import { chainsSupportedBy3cities } from './chains';

// TODO can we add a provider for a localhost ethrpc url for L1, eg. http://localhost:8545, and default to it? This would allow power users to automatically benefit from running their own ethrpc. However, there is a potential downside: it's possible that the ethrpc on localhost would be relatively unperformant. Eg. imagine on mobile, Coinbase Wallet gave every user an ethrpc running on http://localhost:8545, then 3cities might automatically pick this up, but what if this local node sucks for querying chain data? eg. slow, needs to ask other nodes for data --> perhaps it's better to avoid defautling to localhost and add it as an app config option. ethrpc urls could be set in CheckoutSettings (eg. EF specifies that customers should use the EF's rpc urls) or in app-wide settings (eg. Me -> Settings -> ethrpc urls)

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
    new InjectedConnector({ // NB connectkit's wallet connection modal will only show InjectedConnector in the list of available wallets if there's actually a non-metamask, non-coinbase browser wallet extension, see shouldShowInjectedConnector https://github.com/family/connectkit/blob/8ac82c816c76df9154c37347c0721219d2b88a14/packages/connectkit/src/components/Pages/Connectors/index.tsx#L115 --> I was able to get Backpack.app wallet working --> connectkit detects this InjectedConnector in the wagmi.Client and also detects the Backpack browser extension, and then surfaces the wallet option "Browser Wallet" (NB phantom doesn't show up as an InjectedConnector/Browser Wallet, nor does it show up as a fake MetaMask wallet, it simply doesn't show up) --> TODO update connectkit to latest and then injectedconnector support will be much improved and this comment can be updated
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

// TODO -- I'd like to apply certain default options to all wagmi hooks, however based on testing, the staleTime below isn't actually applied to all queries, and staleTime must be added manually to each hook's options. How to fix this to properly apply default query options to all hooks? --> Perhaps don't try again until we update to latest wagmi.
// wagmiClient.queryClient.setDefaultOptions({
//   queries: Object.assign({}, wagmiClient.queryClient.getDefaultOptions().queries, { // use this Object.assign to preserve existing default query options, overwriting only opts we wish to update.
//     staleTime: 15_000, // milliseconds until cached result is considered stale and will be refetched if subsequently requested. One reason it's important for us to have a short stale time is that if a user is temporarily offline, a result fetched while offline will be undefined and that undefined result will persist in the cache even after the user goes back online. For example, if we fetch a token balance or resolve an ENS name while the user is temporarily offline, that empty result will make it seem like the user has a zero balance for that token or an ENS name that's invalid or has address unset, when in reality the user was only temporarily offline and we want to re-fetch data when back online.
//   }),
// });

// console.log("wagmiClient.chains", wagmiClient.chains); // WARNING wagmiClient.chains seems to be defined if and only if the wallet is currently connected. For that reason, we shouldn't rely on wagmiClient.chains to power any downstream config https://github.com/wagmi-dev/wagmi/discussions/1832
