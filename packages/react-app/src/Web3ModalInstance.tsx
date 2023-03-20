// This is our Web3Modal integration. It works, but we are currently
// using connectkit and so this code has been commented out.
// Modal usage:
//   import Web3ModalInstance from "./Web3ModalInstance";
//   <Web3ModalInstance />
// Connect wallet button usage to trigger modal:
//   import { Web3Button } from "@web3modal/react";
//   <Web3Button icon="hide" />

// import { EthereumClient } from "@web3modal/ethereum";
// import { Web3Modal } from "@web3modal/react";
// import React from "react";
// import { chainsSupportedBy3cities } from "./chains";
// import { wagmiClient } from "./wagmiClient";

// const ethereumClient = new EthereumClient(wagmiClient, chainsSupportedBy3cities); // NB here we might be tempted to replace chainsSupportedBy3cities with wagmiClient.chains, however, wagmiClient.chains seems to be defined if and only if the wallet is currently connected. For that reason, we shouldn't rely on wagmiClient.chains as an input to this config https://github.com/wagmi-dev/wagmi/discussions/1832

// const Web3ModalInstance = () => <Web3Modal
//   projectId="a85a7f7f5074fd8ffe48a9805ed740f9" // TODO this is our test projectId. --> make into env var and make a production projectId, and regenerate this test projectId since it has been committed to git
//   ethereumClient={ethereumClient}
// />;

// export default Web3ModalInstance;
