// Old:
// import React, { useCallback, useEffect, useMemo, useState } from "react";
// import { Link } from "react-router-dom";
// import logo from "./images/logo.jpg";
// // import { Web3Button } from "@web3modal/react";
// import { ConnectKitButton } from "connectkit";
// // import { ConnectButton } from '@shopify/connect-wallet';
// import { useConnect, useNetwork } from "wagmi";
// import { chainsSupportedBy3cities } from "./chains";
// import { useInput } from "./useInput";
// import { makeAndSetWeb3AuthConnector } from "./wagmiClient";
// import { Web3AuthConnector, Web3AuthLoginProvider } from "./Web3AuthConnector";

import React from "react";
import { Link } from "react-router-dom";
import logo from "./images/logo.jpg";
import { ConnectKitButton } from "connectkit";

/*
  TODO ship web3auth integration
    tasks:
      1. add embedded email/google/etc logins to connectkit's modal
        design options
          A) if connectkit ships the feature I asked for, use that https://github.com/family/connectkit/discussions/194
          B) use our fork of connectkit:
            i. implement the feature I requested by adding ConnectKitProvider args and editing src/components/ConnectModal/index.tsx to use these new args to make new "pages" in the modal
            ii. use the new feature to build an embedded login form. This will likely involve moving the web3auth code here in Header.tsx to a new permanent home.
                current thought on modal visual design:
                  [Email Address]      <submit>
                  -----------------------------
                  [google] [facebook] [option3]
      2. re-enable tryReconnectToWeb3Auth by uncommenting its code so that automatic reconnection works again.
      3. in our ConnectWalletButtonCustom, note that isConnecting is broken due to bugs in connectkit, but we want our connect button to show 'Connecting' while web3auth login is in process, so we should add a manual variable in our web3auth machinery to hardcode a direct connection from ConnectWalletButtonCustom and web3auth connecting or auto-reconnecting.
      4. move the web3auth-specific stuff in wagmiClient.ts to its own file
      5. production security
        i. double-check the whitelisted origin security where if I open 3cities in a different ipfs gateway, I should be unable to sign web3auth transactions because they don't originate from https://3cities.xyz --> this is an important security mechanism to prevent copies of our codebas from stealing customer funds since web3auth auto-confirms transactions
        ii. add 2FA to my web3auth account
      6. that should be it! Our web3auth integration is live
*/

// TODO ConnectKitButton should use the email or SMS as the connected wallet label when you log in with oauth, instead of the connected address. Alternatively, we could build scaffolding around ConnectButton so that it gets hidden/swapped out for a login/logout label --> I like this architecture idea of a preprocessor/wrapped around the chosen modal so as to better control the precise UX, add our own email/SMS login option UX, while still benefiting from all of the work they've done on the modal, and being able to swap out to a different underlying connect wallet button/modal

// const ConnectToWeb3AuthViaEmailButtonOld: React.FC = () => {
//   const { connect, error, isLoading, pendingConnector } = useConnect();
//   const { chain } = useNetwork();
//   return <div>
//     <button onClick={() => connect({ connector: web3AuthEmailConnector, chainId: chainsSupportedBy3cities[0].id })} disabled={!web3AuthEmailConnector.ready}>
//       Email Login
//       {!web3AuthEmailConnector.ready && ' (connector not ready)'}
//       {isLoading && pendingConnector && pendingConnector.id === web3AuthEmailConnector.id && ' (connecting)'}
//     </button>
//     {error && <div>{error.message}</div>}
//     {chain && <div>current chain: {chain.id} {chain.name}</div>}
//   </div>;
// }

// const ConnectToWeb3AuthViaSmsButton: React.FC = () => {
//   const { connect, error, isLoading, pendingConnector } = useConnect();
//   const { chain } = useNetwork();
//   return <div>
//     <button onClick={() => connect({ connector: web3AuthSmsConnector, chainId: chainsSupportedBy3cities[0].id })} disabled={!web3AuthSmsConnector.ready}>
//       SMS Login
//       {!web3AuthSmsConnector.ready && ' (connector not ready)'}
//       {isLoading && pendingConnector && pendingConnector.id === web3AuthSmsConnector.id && ' (connecting)'}
//     </button>
//     {error && <div>{error.message}</div>}
//     {chain && <div>current chain: {chain.id} {chain.name}</div>}
//   </div>;
// }

// const ConnectToWeb3AuthViaGoogleButton: React.FC = () => {
//   const { connect, error, isLoading, pendingConnector } = useConnect();
//   const { chain } = useNetwork();
//   return <div>
//     <button onClick={() => connect({ connector: web3AuthGoogleConnector, chainId: chainsSupportedBy3cities[0].id })} disabled={!web3AuthGoogleConnector.ready}>
//       Google Login
//       {!web3AuthGoogleConnector.ready && ' (connector not ready)'}
//       {isLoading && pendingConnector && pendingConnector.id === web3AuthGoogleConnector.id && ' (connecting)'}
//     </button>
//     {error && <div>{error.message}</div>}
//     {chain && <div>current chain: {chain.id} {chain.name}</div>}
//   </div>;
// }

// const DisconnectAndDestroyActiveConnector: React.FC = () => {
//   const { connector: activeConnector } = useAccount();
//   const { disconnectAsync } = useDisconnect();

//   const d = async () => {
//     if (!activeConnector) return;
//     console.log("disconnect", activeConnector);
//     await disconnectAsync();
//     wagmiClient.setState(s => {
//       return Object.assign({}, s, {
//         connectors: s.connectors.filter(c => c.id !== activeConnector.id),
//       });
//     });
//   };
//   return <div>
//     <button onClick={d} disabled={!activeConnector}> disconnect active connector</button >
//   </div >;
// }

// ************************************************************
// BEGIN -- best email impl of web3auth integration(google impl below)
// const emailAttrs = { type: 'email', placeholder: 'Email' };
// export const ConnectToWeb3AuthViaEmailButton: React.FC = () => {
//   const [isLoadingConnector, setIsLoadingConnector] = useState(false);
//   const [web3AuthConnector, setWeb3AuthConnector] = useState<Web3AuthConnector | undefined>(undefined);
//   const [triggerLogin, setTriggerLogin] = useState(false);
//   const opts = useMemo(() => {
//     return {
//       onEnterKeyPress: () => setTriggerLogin(true),
//     };
//   }, [setTriggerLogin]);
//   const [email, emailInput] = useInput('ryanberckmans@gmail.com', emailAttrs, opts);
//   const { connectAsync, error, isLoading, pendingConnector } = useConnect();
//   const { chain } = useNetwork();

//   useEffect(() => {
//     if (isLoadingConnector && web3AuthConnector !== undefined) setIsLoadingConnector(false);
//   }, [isLoadingConnector, web3AuthConnector]);

//   const loginWithEmail = useCallback(async () => {
//     setIsLoadingConnector(true);
//     const validatedEmail = email; // TODO where to do email validation? here?
//     const l: Web3AuthLoginProvider = {
//       loginProvider: 'email',
//       email: validatedEmail,
//     };
//     const web3AuthConnector = await makeAndSetWeb3AuthConnector(l); // TODO use React.lazy with Suspense when calling makeAndSetWeb3AuthConnector which fetches the web3Auth chunk
//     setWeb3AuthConnector(web3AuthConnector);

//     await connectAsync({
//       connector: web3AuthConnector.connector,
//       chainId: chainsSupportedBy3cities[0].id, // here we pass a supported chainId (happens to be the 0th's chain's id, but that's unimportant) to avoid the case where the connector defaults to an unsupported chain, such as defaulting to chainId 1 when not in production
//     });
//   }, [email, connectAsync, setIsLoadingConnector, setWeb3AuthConnector]);
//   useEffect(() => {
//     if (triggerLogin) {
//       loginWithEmail();
//       setTriggerLogin(false);
//     }
//   }, [triggerLogin, setTriggerLogin, loginWithEmail]);

//   return <div>
//     {emailInput}
//     <button onClick={() => loginWithEmail()} disabled={isLoadingConnector || (web3AuthConnector && !web3AuthConnector.connector.ready)}>
//       Email Login
//       {web3AuthConnector && !web3AuthConnector.connector.ready && ' (connector not ready)'}
//       {web3AuthConnector && isLoading && pendingConnector && pendingConnector.id === web3AuthConnector.connector.id && ' (connecting)'}
//     </button>
//     {isLoadingConnector && <div>loading connector...</div>}
//     {error && <div>{error.message}</div>}
//     {chain && <div>current chain: {chain.id} {chain.name}</div>}
//   </div>;
// }
// END -- best email impl of web3auth integration (google impl below)
// ************************************************************

// const ConnectToWeb3AuthViaGoogleAsyncButton: React.FC = () => {
//   const { connect, error, isLoading, pendingConnector } = useConnect();
//   const { chain } = useNetwork();
//   const [connector, setConnector] = useState<Connector | undefined>(undefined);

//   const getConnector = async () => {
//     setConnector(await getWeb3AuthGoogleConnector());
//   };

//   useEffect(() => {
//     if (connector === undefined) return;
//     connect({
//       connector,
//       chainId: chainsSupportedBy3cities[0].id, // here we pass a supported chainId (happens to be the 0th's chain's id, but that's unimportant) to avoid the case where the connector defaults to an unsupported chain, such as defaulting to chainId 1 when not in production
//     });
//     return () => {
//       // TODO remove web3auth connector on component unmount? but once the connector is added, we want it to persist for lifecycle of wagmiclient --> we need addWeb3AuthGoogleConnector to be idempotent so that this component won't add redundant connectors or remove the singleton added connector on unmount --> I don't think anything needs to be done on unmount now that web3AuthGoogleConnector is a singleton
//     };
//   }, [connect, connector]);

//   return <div>
//     <button onClick={() => getConnector()} disabled={connector && !connector.ready}>
//       Google Login
//       {connector && !connector.ready && ' (connector not ready)'}
//       {connector && isLoading && pendingConnector && pendingConnector.id === connector.id && ' (connecting)'}
//     </button>
//     {error && <div>{error.message}</div>}
//     {chain && <div>current chain: {chain.id} {chain.name}</div>}
//   </div>;
// }

export function HeaderOld() {
  return (
    <header className="bg-white p-5 shadow-md min-h-[80px]">
      <div className="mx-auto flex w-full max-w-screen-lg items-center justify-between">
        <Link to="/" className="flex items-center">
          <img src={logo} className="mt-1 w-8" alt="3cities" />
          <span className="text-2xl font-extrabold tracking-tight">
            3cities&nbsp;&nbsp;&nbsp;&nbsp;
          </span>
        </Link>
        <div className="flex flex-1 items-center justify-end gap-8">
          {/* <div className="shrink">
            <ConnectToWeb3AuthViaEmailButton />
          </div> */}
          <div className="shrink">
            <ConnectKitButton showBalance={false} showAvatar={false} onClick={(open: () => void) => open()} />
          </div>
          {/* <Web3Button icon="hide" /> */ /* TODO we can't use web3modal right now because of bugs in WalletConnectConnector which should become resolved after these libs finish the current transition to walletconnect v2. See notes on WalletConnectConnector in wagmi config. */}
          {/* <ConnectToWeb3AuthViaEmailButton />
          <ConnectToWeb3AuthViaSmsButton /> */}
          {/* <DisconnectAndDestroyActiveConnector /> */}
          {/* <ConnectToWeb3AuthViaGoogleAsyncButton /> */}
          {/* <ConnectButton /> TODO connect-wallet support blocked by runtime error https://github.com/Shopify/blockchain-components/issues/16 */}
        </div>
      </div>
    </header>
  );
}
