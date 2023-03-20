import { Connector } from "wagmi";

// NB the goal of this Web3AuthConnector module is to provide the types necessary for clients to prepare to load an underlying Web3Auth connector, but for clients to complete this preparation without actually loading the underlying web3auth libraries, which are in a separate module to facilitate code splitting

export type Web3AuthLoginProviders = 'email' | 'google' // list of our currently supported login methods using web3Auth. See the full list of web3auth's supported login methods https://web3auth.io/docs/sdk/web/openlogin#openloginloginparams. Note that web3auth currently doesn't support sending SMS OTP codes themselves. To enable SMS logins, it's currently necessary to use a third-party SMS OTP provider https://github.com/orgs/Web3Auth/discussions/1298#discussioncomment-4953285

type Web3AuthLoginProviderBase<L extends Web3AuthLoginProviders> = {
  loginProvider: L;
}

export type Web3AuthLoginProvider =
  (Web3AuthLoginProviderBase<'email'> & {
    email: string; // email to login with. Assumes email format is already validated
  })
  | Web3AuthLoginProviderBase<'google'>

export type Web3AuthConnector = Readonly<{ // Web3AuthConnector is the primary client-facing export of our Web3Auth wrapper convenience library. It exposes a wagmi.Connector to login with web3Auth, and convenience APIs associated with this connector
  loginProvider: Web3AuthLoginProvider; // login provider with which this Web3AuthConnector has been configured
  connector: Connector // wagmi Connector that's the Web3AuthConnector constructed using `loginProvider`
}>
