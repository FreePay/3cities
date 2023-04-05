import { ConnectKitProvider } from "connectkit";
import { ConnectKitOptions } from "connectkit/build/types";
import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster } from 'sonner';
import { WagmiConfig } from "wagmi";
import App from "./App";
import { buildGitCommit, buildGitCommitDate, buildGitTag } from "./buildInfo";
import { ConnectedWalletAddressContextObserverProvider } from "./connectedWalletContextProvider";
import "./index.css";
import { MainWrapper } from "./MainWrapper";
import { Pay } from "./Pay";
import { wagmiClient } from "./wagmiClient";

const root = createRoot((() => {
  const r = document.getElementById("root");
  if (r === null) throw new Error("couldn't find root element");
  return r;
})());

document.getElementById("loading-placeholder")?.remove();

const connectKitOptions: ConnectKitOptions = {
  // hideTooltips: true, // TODO do we want this?
  walletConnectName: "WalletConnect", // default is "Other Wallets" which I find confusing because anybody who knows they can scan a qr code from mobile will most likely be looking for the name "WalletConnect"
  bufferPolyfill: false, // disable connectkit's Buffer polyfill because we have our own
  initialChainId: 0, // don't target a specific chain to connect to
  enforceSupportedChains: false,
  hideNoWalletCTA: true, // hide "I don't have a wallet" in the connectkit modal because 3cities isn't in the business of converting users into non-custodial wallets; we serve two segments: crypto natives that already have wallets, and sellers new to crypto for which we'll offer email/sms oauth options to create a new semi-custodial wallet
  hideQuestionMarkCTA: true, // true for same reason as hideNoWalletCTA
};

root.render(
  // NB as of React 18, when you use Strict Mode, React renders each component twice to help you find unexpected side effects. If you have React DevTools installed, the second log’s renders will be displayed in grey, and there will be an option (off by default) to suppress them completely
  <React.StrictMode>
    <WagmiConfig client={wagmiClient}>
      {/* <ConnectWalletProvider chains={chainsSupportedBy3cities}>  TODO connect-wallet support blocked by runtime error https://github.com/Shopify/blockchain-components/issues/16 */}
      <ConnectKitProvider options={connectKitOptions}>
        <ConnectedWalletAddressContextObserverProvider>
          <Toaster /> {/* NB here we put the toaster inside the wagmi, connectkit, and addressContext providers so that the toast clients can have access to these services */}
          <HashRouter>
            <MainWrapper>
              <Routes>
                {/* TODO refactor this to use react-router's nested routers and Outlet where there's a single App component that contains the Container/Header/WalletButton and Pay is rendered into an outlet --> TODO in this updated App component, a global error boundary around the Outlet that dumps the error contents to the viewport, so that if a customer gets an error, they have a screenshot to send me. right now, an uncaught error results in a blank screen */}
                <Route path="/" element={<App />} />
                <Route path="/pay" element={<Pay />} />
                <Route path="/build" element={<span>3cities {buildGitTag} {buildGitCommit} {buildGitCommitDate}<br />Time now: {(new Date()).toUTCString()}</span>} />
              </Routes>
            </MainWrapper>
          </HashRouter>
        </ConnectedWalletAddressContextObserverProvider>
      </ConnectKitProvider>
      {/* </ConnectWalletProvider> */}
    </WagmiConfig>
    {/* <Web3ModalInstance /> */ /* TODO we can't use web3modal right now because of bugs in WalletConnectConnector which should become resolved after these libs finish the current transition to walletconnect v2. See notes on WalletConnectConnector in wagmi config. */}
  </React.StrictMode>
);
