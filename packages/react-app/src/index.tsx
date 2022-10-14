import { ApolloClient, ApolloProvider, InMemoryCache } from "@apollo/client";
import { DAppProvider } from "@usedapp/core";
import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Link, Route, Routes } from "react-router-dom";
import App from "./App";
import { buildGitCommit, buildGitCommitDate, buildGitTag, buildPackageJsonVersion } from "./buildInfo";
import { ConnectedWalletAddressContextObserverProvider } from "./connectedWalletContextProvider";
import "./index.css";
import { MainWrapper } from "./MainWrapper";
import { Pay } from "./Pay";
import { config } from "./usedappConfig";

// You should replace this url with your own and put it into a .env file
// See all subgraphs: https://thegraph.com/explorer/
const client = new ApolloClient({
  cache: new InMemoryCache(),
  uri: "https://api.thegraph.com/subgraphs/name/paulrberg/create-eth-app",
});

const root = createRoot((() => {
  const r = document.getElementById("root");
  if (r === null) throw new Error("couldn't find root element");
  return r;
})());

root.render(
  // NB as of React 18, when you use Strict Mode, React renders each component twice to help you find unexpected side effects. If you have React DevTools installed, the second log’s renders will be displayed in grey, and there will be an option (off by default) to suppress them completely
  <React.StrictMode>
    <DAppProvider config={config} >
      <ConnectedWalletAddressContextObserverProvider>
        <ApolloProvider client={client} >
          <HashRouter>
            <MainWrapper>
              <Routes>
                {/* TODO refactor this to use react-router's nested routers and Outlet where there's a single App component that contains the Container/Header/WalletButton and Pay is rendered into an outlet */}
                <Route path="/" element={<App />} />
                <Route path="/pay" element={<Pay />} />
                <Route path="/build" element={<span><Link to="/">3cities</Link> package: {buildPackageJsonVersion} git: {buildGitTag} {buildGitCommit} {buildGitCommitDate}</span>} />
              </Routes>
            </MainWrapper>
          </HashRouter>
        </ApolloProvider>
      </ConnectedWalletAddressContextObserverProvider>
    </DAppProvider>
  </React.StrictMode>
);
