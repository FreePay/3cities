import { alchemyHttpUrl, chainsSupportedBy3cities, infuraHttpUrl } from '@3cities/core';
import { createConfig, fallback, http, type Transport } from '@wagmi/core';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';

const walletConnectProjectId: string = (() => {
  const s = process.env['REACT_APP_WALLETCONNECT_PROJECT_ID'];
  if (s === undefined) {
    console.error("REACT_APP_WALLETCONNECT_PROJECT_ID undefined");
    return 'REACT_APP_WALLETCONNECT_PROJECT_ID_undefined';
  } else return s;
})();

function makeTransport(chainId: number): Transport {
  // NB fallback attempts each transport in priority order for every query, only falling back to the next transport if a query fails for the previous. Ie. by default, if a transport is unreachable for an extended period, fallback will still attempt to query it for every single query. TODO smart detection for offline transports and/or slow transports can be accessed via transport auto ranking https://viem.sh/docs/clients/transports/fallback.html#transport-ranking
  // TODO consider supporting using the connected wallet's rpc https://wagmi.sh/react/api/transports/unstable_connector --> power users may prefer that queries be routed through their wallet's rpc
  // TODO consider supporting a localhost rpc url for the L1 and perhaps other chains, so that power users running their own nodes may default to use these nodes, which is more private
  // TODO consider adding app-wide user settings for rpc urls (eg. Me -> Settings -> Network -> RPC URLs) so that non-technical users can configure their own rpcs (eg. saved on localstorage) without having to build their own copy of 3cities

  const httpOpts = {
    batch: {
      wait: 16, // milliseconds to wait for client requests to arrive before sending them all as a single batch. Default is 0 (only requests sent during the same javascript event loop are batched) however we provide a slightly longer batch wait because many of our queries are token balance fetches that are triggered by React timers that often take more than one JavaScript event loop to settle. TODO experiment with different wait times
      batchSize: 1_000, // 1_000 is the default batchSize
    }
  };

  return fallback([
    http(alchemyHttpUrl(chainId), httpOpts),
    http(infuraHttpUrl(chainId), httpOpts),
    http(undefined, httpOpts), // http() with no url causes the chain's default rpc to be used
  ].filter(Boolean));
}

const transports = chainsSupportedBy3cities.reduce<{ [chainId: number]: Transport }>((ts, c) => {
  ts[c.id] = makeTransport(c.id);
  return ts;
}, {});

export const wagmiConfig = createConfig({
  chains: chainsSupportedBy3cities,
  connectors: [
    injected(), // NB by default, wagmi automatically discovers all available injected providers via EIP-6963 https://wagmi.sh/vue/api/connectors/injected#target
    coinbaseWallet({
      appName: "3cities",
      appLogoUrl: "https://3cities.xyz/android-chrome-192x192.png",
      preference: "all", // support all of Browser Extension, Mobile Coinbase Wallet, and Smart Wallet
    }),
    walletConnect({
      projectId: walletConnectProjectId,
      showQrModal: false,
      metadata: {
        name: '3cities',
        description: '3cities is decentralized payment processor for Ethereum',
        url: 'https://3cities.xyz',
        icons: ['https://3cities.xyz/android-chrome-192x192.png'],
      },
    }),
  ],
  transports,
})
