import { CHAIN_NAMESPACES } from "@web3auth/base";
import { Web3AuthNoModal } from "@web3auth/no-modal";
import { OpenloginAdapter, OpenloginLoginParams } from "@web3auth/openlogin-adapter";
import { Web3AuthConnector as UnderlyingWeb3AuthConnector } from "@web3auth/web3auth-wagmi-connector";
import { Chain, Connector } from "wagmi";
import { isProduction } from "./isProduction";
import { NonEmptyArray } from "./NonEmptyArray";
import { Web3AuthConnector, Web3AuthLoginProvider } from "./Web3AuthConnector";

const web3AuthClientId: string = (() => {
  const s = process.env['REACT_APP_WEB3AUTH_CLIENT_ID'];
  if (s === undefined) {
    console.error("REACT_APP_WEB3AUTH_CLIENT_ID undefined");
    return 'REACT_APP_WEB3AUTH_CLIENT_ID_undefined';
  } else return s;
})();

function toOpenloginLoginParams(l: Web3AuthLoginProvider): OpenloginLoginParams {
  const sharedParams: Pick<OpenloginLoginParams, 'sessionTime'> = {
    sessionTime: web3AuthSessionTime,
  };
  switch (l.loginProvider) {
    case "email": return Object.assign({
      loginProvider: 'email_passwordless',
      extraLoginOptions: {
        login_hint: l.email,
      }
    }, sharedParams);
    case "google": return Object.assign({
      loginProvider: 'google',
    }, sharedParams);
  }
}

const web3AuthSessionTime: number = isProduction ? ( // length of time in seconds that a user will remain logged in after a successful login with web3auth
  60 * 60 * 24 * 7 // 7 days in seconds until session expiry (this is the maximum supported value; using the maximum in production reduces friction for users because they have to login less often)
) : (
  60 * 30 // 30 minutes in seconds. Logging in more often outside of production helps to uncover any issues with the login flow
);

const openloginAdapter = new OpenloginAdapter({
  adapterSettings: {
    // NB clientId doesn't need to be set here because it's provided in the Web3AuthCore instance
    // NB network doesn't need to be set here because it's provided in the Web3AuthCore instance
    uxMode: "popup",
    whiteLabel: {
      name: isProduction ? "3cities" : "[dev] 3cities",
      logoLight: "https://web3auth.io/images/w3a-L-Favicon-1.svg", // TODO 3cities logo
      logoDark: "https://web3auth.io/images/w3a-D-Favicon-1.svg", // TODO 3cities logo
      defaultLanguage: "en",
      dark: false, // whether to enable dark mode. defaultValue: false
    },
  },
});

export function makeWeb3AuthConnector(chains: NonEmptyArray<Chain>, loginProvider: Web3AuthLoginProvider): Web3AuthConnector {
  const web3AuthInstance = new Web3AuthNoModal({
    chainConfig: {
      chainNamespace: CHAIN_NAMESPACES.EIP155,
      chainId: chains[0].id.toString(), // NB if chainId is omitted, Web3AuthCore connects to mainnet (chainId 1) by default, so here, we pass the 1st chainId from chainsSupportedBy3cities to ensure that the initial chain connected to by Web3Auth is in fact a chain we support. In particular, we want to avoid connecting to mainnet when in not in production.
    },
    clientId: web3AuthClientId,
    sessionTime: web3AuthSessionTime,
    web3AuthNetwork: isProduction ? "mainnet" : "testnet",
  });
  web3AuthInstance.configureAdapter(openloginAdapter);

  const connector: Connector = new UnderlyingWeb3AuthConnector({
    chains,
    options: {
      web3AuthInstance,
      loginParams: toOpenloginLoginParams(loginProvider),
    },
    // NB Web3AuthConnector.options.modalConfig is used only for @web3auth/modal (a wallet connect button + modal), which we are not using
  });
  return Object.freeze({
    loginProvider: Object.freeze(loginProvider),
    connector,
  });
}
