import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectKitProvider } from "connectkit";
import React from "react";
import { Outlet, ScrollRestoration } from "react-router-dom";
import { Toaster } from 'sonner';
import { WagmiProvider } from 'wagmi';
import { ConnectedAccountContextObserverProvider } from "./ConnectedAccountContextObserverProvider";
import { DemoAccountProvider } from "./DemoAccountProvider";
import { ExchangeRatesProvider } from "./ExchangeRatesProvider";
import { IsPageVisibleOrRecentlyVisibleProvider } from "./IsPageVisibleOrRecentlyVisibleProvider";
import { ShowIfRunningNotInProduction } from "./ShowIfRunningNotInProduction";
import { wagmiConfig } from './wagmiConfig';

const queryClient = new QueryClient({
  // NB react-query supports refetchIntervalInBackground which is a partial substitute for our useIsPageVisibleOrRecentlyVisible
  // TODO consider local persistence for query cache (perhaps using localforage as the persistence adapter). However, local persistence may be of limited usefulness if, by default, we mark cached results as stale after 15 seconds https://tanstack.com/query/v5/docs/framework/react/plugins/persistQueryClient#usage-with-react
  defaultOptions: {
    queries: {
      gcTime: 1_000 * 60 * 60, // 1 hour in milliseconds
      staleTime: 1_000, // milliseconds until cached result is considered stale and will be refetched if subsequently requested. 3cities generally always wants to be operating on fresh data, and viem provides efficient query batching, so we set stale time quite low
    }
  }
});

const connectKitOptions/* : ConnectKitOptions --> type ConnectKitOptions no longer imports successfully after we switched from tsconfig moduleResolution "node" to "bundler" --> TODO fix it, perhaps by asking connectkit to make their export compatible with "bundler" */ = {
  hideBalance: true,
  walletConnectName: "WalletConnect", // default is "Other Wallets" which I find confusing because anybody who knows they can scan a qr code from mobile will most likely be looking for the name "WalletConnect"
  bufferPolyfill: false, // disable connectkit's Buffer polyfill because we have our own
  initialChainId: 0, // don't target a specific chain to connect to
  enforceSupportedChains: false,
  hideNoWalletCTA: true, // hide "I don't have a wallet" in the connectkit modal because 3cities isn't in the business of converting users into non-custodial wallets; we serve two segments: crypto natives that already have wallets, and sellers new to crypto for which we'll offer email/sms oauth options to create a new semi-custodial wallet
  hideQuestionMarkCTA: true, // true for same reason as hideNoWalletCTA
};

export const GlobalProviders = () => {
  return <div>
    <ShowIfRunningNotInProduction />
    <ScrollRestoration /> {/* https://reactrouter.com/en/main/components/scroll-restoration */}
    <WagmiProvider config={wagmiConfig} reconnectOnMount={true}>
      <QueryClientProvider client={queryClient}>
        <IsPageVisibleOrRecentlyVisibleProvider>
          <DemoAccountProvider> {/* WARNING DemoAccountProvider must be nested inside IsPageVisibleOrRecentlyVisibleProvider because DemoAccountProvider depends on ens name resolution and that depends on page recent visiblity */}
            <ConnectKitProvider options={connectKitOptions}>
              <ConnectedAccountContextObserverProvider>
                <ExchangeRatesProvider>
                  <Toaster richColors /> {/* NB here we put the toaster inside all other providers so that the toast clients can have access to these services */}
                  <Outlet />
                </ExchangeRatesProvider>
              </ConnectedAccountContextObserverProvider>
            </ConnectKitProvider>
          </DemoAccountProvider>
        </IsPageVisibleOrRecentlyVisibleProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </div>;
};
