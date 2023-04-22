import { CHAIN_NAMESPACES, CustomChainConfig } from "@web3auth/base";
import { Web3AuthNoModal } from "@web3auth/no-modal";
import { OpenloginAdapter, OpenloginLoginParams } from "@web3auth/openlogin-adapter";
import { Web3AuthConnector as UnderlyingWeb3AuthConnector } from "@web3auth/web3auth-wagmi-connector";
import { Chain, Connector } from "wagmi";
import { unsafeGetChainThrowIfNotFound } from "./chains";
import { isProduction } from "./isProduction";
import { NonEmptyArray } from "./NonEmptyArray";
import { NativeCurrency } from "./Token";
import { nativeCurrencies } from "./tokens";
import { Web3AuthConnector, Web3AuthLoginProvider } from "./Web3AuthConnector";

const web3AuthClientId: string = (() => {
  const s = process.env['REACT_APP_WEB3AUTH_CLIENT_ID'];
  if (s === undefined) {
    console.error("REACT_APP_WEB3AUTH_CLIENT_ID undefined");
    return 'REACT_APP_WEB3AUTH_CLIENT_ID_undefined';
  } else return s;
})();

function toOpenloginLoginParams(l: Web3AuthLoginProvider): OpenloginLoginParams {
  const sharedParams: Pick<OpenloginLoginParams, 'sessionTime' | 'mfaLevel'> = {
    sessionTime: web3AuthSessionTime,
    mfaLevel: 'none', // disable multifactor authentication to avoid confusing and spamming our users, who aren't storing lots of money in their web3auth addresses in 3cities. TODO re-enable mfa later if needed
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
  60 * 60 * 3 // 3 hours in seconds. Logging in more often outside of production helps to uncover any issues with the login flow
);

const openloginAdapter = new OpenloginAdapter({
  adapterSettings: {
    // NB clientId doesn't need to be set here because it's provided in the Web3AuthCore instance
    // NB network doesn't need to be set here because it's provided in the Web3AuthCore instance
    uxMode: "popup",
    whiteLabel: {
      name: isProduction ? "3cities" : "[dev] 3cities",
      logoLight: "https://3cities.xyz/logo.png",
      logoDark: "https://3cities.xyz/logo.png", // TODO an actual dark logo
      defaultLanguage: "en",
      dark: false, // whether to enable dark mode. defaultValue: false
    },
  },
});

function makeChainConfig(chainId: number): CustomChainConfig {
  const c = unsafeGetChainThrowIfNotFound(chainId);
  const rpcTarget: string = (() => {
    const r = c.rpcUrls.default;
    if (r === undefined) throw new Error(`Chain ${chainId} has no default rpcUrls`);
    const r0 = r.http[0];
    if (r0 === undefined) throw new Error(`Chain ${chainId} has no http rpcUrls`);
    return r0;
  })()
  const blockExplorer: string = (() => {
    if (c.blockExplorers === undefined) throw new Error(`Chain ${chainId} has no blockExplorerUrls`);
    const b = c.blockExplorers.default;
    if (b === undefined) throw new Error(`Chain ${chainId} has no default block explorers`);
    return b.url;
  })();
  const nativeCurrency: NativeCurrency = (() => {
    const nc = nativeCurrencies.find(n => n.chainId === chainId);
    if (nc === undefined) throw new Error(`Chain ${chainId} has no nativeCurrency`);
    return nc;
  })();
  return {
    chainNamespace: CHAIN_NAMESPACES.EIP155,
    chainId: `0x${chainId.toString(16)}`,
    rpcTarget,
    displayName: c.name,
    blockExplorer,
    ticker: nativeCurrency.ticker,
    tickerName: nativeCurrency.name,
    decimals: nativeCurrency.decimals,
  };
}

export function makeWeb3AuthConnector(chains: NonEmptyArray<Chain>, loginProvider: Web3AuthLoginProvider): Web3AuthConnector {
  const web3AuthInstance = new Web3AuthNoModal({
    clientId: web3AuthClientId,
    chainConfig: makeChainConfig(chains[0].id),
    sessionTime: web3AuthSessionTime,
    // web3AuthNetwork: --> NB there's no need to set web3AuthNetwork as each clientId is bound to a single network, so web3auth knows if we're using testnet or mainnet based on the clientId. Note that web3auth has different production networks based on global region (north america, india, asia, etc) and in future, we could have regional builds where the injected clientId is selected based on the region.
    web3AuthNetwork: isProduction ? "cyan" : "testnet", // NB although a web3auth clientId is bound to a single network and therefore web3auth should know if we're using testnet or cyan/mainnet/etc based on the clientId, it still seems to be required to pass web3AuthNetwork, or else transactions don't seem to confirm properly.. Note that web3auth has different production networks based on global region (north america, india, asia, etc) and in future, we could have regional builds where the injected clientId is selected based on the region.
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
