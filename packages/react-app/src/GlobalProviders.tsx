import { ConnectKitProvider } from "connectkit";
import { ConnectKitOptions } from "connectkit/build/types";
import React from "react";
import { Outlet, ScrollRestoration } from "react-router-dom";
import { Toaster } from 'sonner';
import { WagmiConfig } from "wagmi";
import { ConnectedAccountContextObserverProvider } from "./ConnectedAccountContextObserverProvider";
import { DemoAccountProvider } from "./DemoAccountProvider";
import { ExchangeRatesProvider } from "./ExchangeRatesProvider";
import { IsPageVisibleOrRecentlyVisibleProvider } from "./IsPageVisibleOrRecentlyVisibleProvider";
import { wagmiClient } from "./wagmiClient";
import { ShowIfRunningLocally } from "./ShowIfRunningLocally";

const connectKitOptions: ConnectKitOptions = {
  walletConnectName: "WalletConnect", // default is "Other Wallets" which I find confusing because anybody who knows they can scan a qr code from mobile will most likely be looking for the name "WalletConnect"
  bufferPolyfill: false, // disable connectkit's Buffer polyfill because we have our own
  initialChainId: 0, // don't target a specific chain to connect to
  enforceSupportedChains: false,
  hideNoWalletCTA: true, // hide "I don't have a wallet" in the connectkit modal because 3cities isn't in the business of converting users into non-custodial wallets; we serve two segments: crypto natives that already have wallets, and sellers new to crypto for which we'll offer email/sms oauth options to create a new semi-custodial wallet
  hideQuestionMarkCTA: true, // true for same reason as hideNoWalletCTA
};

export const GlobalProviders = () => {
  return <div>
    <ShowIfRunningLocally />
    <ScrollRestoration /> {/* https://reactrouter.com/en/main/components/scroll-restoration */}
    <WagmiConfig client={wagmiClient}>
      {/* <ConnectWalletProvider chains={chainsSupportedBy3cities}>  TODO connect-wallet support blocked by runtime error https://github.com/Shopify/blockchain-components/issues/16 */}
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
          {/* </ConnectWalletProvider> */}
        </DemoAccountProvider>
      </IsPageVisibleOrRecentlyVisibleProvider>
    </WagmiConfig>
  </div>;
};
