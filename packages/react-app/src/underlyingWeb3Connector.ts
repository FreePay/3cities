import { Signer } from '@ethersproject/abstract-signer';
import { Web3Provider } from "@ethersproject/providers";
import {
  Address,
  Connector,
  ConnectorData,
  normalizeChainId,
  UserRejectedRequestError
} from "@wagmi/core";
import type { Chain } from "@wagmi/core/chains";
import {
  ADAPTER_STATUS,
  CHAIN_NAMESPACES, CustomChainConfig, IWeb3Auth,
  SafeEventEmitterProvider, WALLET_ADAPTERS
} from "@web3auth/base";
import type { OpenloginLoginParams } from "@web3auth/openlogin-adapter";
import { NonEmptyArray } from "./NonEmptyArray";
import { NativeCurrency } from "./Token";
import { nativeCurrencies } from "./tokens";

export interface Options {
  web3AuthInstance: IWeb3Auth;
  loginParams: OpenloginLoginParams;
}

const IS_SERVER = typeof window === "undefined";

export class Web3AuthConnector extends Connector<
  SafeEventEmitterProvider,
  Options,
  Signer
> {
  ready = !IS_SERVER;

  readonly id = "web3auth";

  readonly name = "Web3Auth";

  provider: SafeEventEmitterProvider | null = null;

  web3AuthInstance: IWeb3Auth;

  initialChainId: number;

  loginParams: OpenloginLoginParams;

  constructor({ chains, options }: { chains: NonEmptyArray<Chain>; options: Options }) {
    super({ chains, options });
    this.web3AuthInstance = options.web3AuthInstance;
    this.loginParams = options.loginParams;
    this.initialChainId = chains[0].id;
  }

  async connect(): Promise<Required<ConnectorData>> {
    try {
      this.emit("message", {
        type: "connecting",
      });

      if (this.web3AuthInstance.status === ADAPTER_STATUS.NOT_READY) {
        await this.web3AuthInstance.init();
      }

      let { provider } = this.web3AuthInstance;

      if (!provider) {
        provider = await this.web3AuthInstance.connectTo(
          WALLET_ADAPTERS.OPENLOGIN,
          this.loginParams
        );
      }

      const signer = await this.getSigner();
      const account = (await signer.getAddress()) as Address;
      provider?.on("accountsChanged", this.onAccountsChanged.bind(this)); // TODO provide can never be null here; update conditional above so it's never null
      provider?.on("chainChanged", this.onChainChanged.bind(this)); // TODO provide can never be null here; update conditional above so it's never null
      const chainId = await this.getChainId();
      const unsupported = this.isChainUnsupported(chainId);
      return {
        account,
        chain: {
          id: chainId,
          unsupported,
        },
        provider,
      };
    } catch (error) {
      console.error("error while connecting", error);
      throw new UserRejectedRequestError(error);
    }
  }

  async getAccount(): Promise<Address> {
    const underlying = await this.getProvider();
    if (underlying === null) throw new Error("getAccount: provider is not defined");
    const provider = new Web3Provider(underlying);
    const signer = provider.getSigner();
    const account = await signer.getAddress();
    return account as Address;
  }

  async getProvider() {
    if (this.provider) return this.provider;
    else {
      this.provider = this.web3AuthInstance.provider;
      if (this.provider === null) throw new Error("getProvider: web3AuthInstance.provider is not defined");
      return this.provider;
    }
  }

  async getSigner(): Promise<Signer> {
    const provider = new Web3Provider(await this.getProvider());
    const signer = provider.getSigner();
    return signer;
  }

  async isAuthorized() {
    try {
      const account = await this.getAccount();
      return !!(account && this.provider);
    } catch {
      return false;
    }
  }

  async getChainId(): Promise<number> {
    if (this.provider) {
      const chainId = await this.provider.request({ method: "eth_chainId" });
      if (chainId) return normalizeChainId(chainId as string);
      else throw new Error("getChainId: failed to get chainId from provider")
    } else if (this.initialChainId) {
      return this.initialChainId;
    } else throw new Error("getChainId: no provider and no initial chainId, so couldn't get chainId");
  }

  override async switchChain(chainId: number) {
    try {
      const chain = this.chains.find((x) => x.id === chainId);
      if (!chain) throw new Error(`Unsupported chainId: ${chainId}`);
      const provider = await this.getProvider();
      if (!provider) throw new Error("Please login first");
      await this.web3AuthInstance.addChain(makeChainConfig(chain));
      await this.web3AuthInstance.switchChain({
        chainId: `0x${chain.id.toString(16)}`,
      });
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const _this = this;
      const waitForProviderNetworkChange = new Promise<void>(
        (resolve, reject) => {
          let attempts = 0;
          async function check() {
            const actualChainId = await _this.getChainId();
            console.log("got chainId", actualChainId, "expected", chainId);
            if (actualChainId === chainId) resolve();
            else if (attempts > 20)
              reject(
                new Error(
                  `timeout waiting for switchChain to complete. expectedChainId=${chainId} actualChainId=${actualChainId}`
                )
              );
            else {
              attempts++;
              setTimeout(check, 100);
            }
          }
          check();
        }
      );
      await waitForProviderNetworkChange;
      const actualChainId = await _this.getChainId();
      console.log("final got chainId", actualChainId, "expected", chainId);
      return chain;
    } catch (error) {
      console.error("Error: Cannot change chain", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.web3AuthInstance.logout();
    this.provider = null;
  }

  protected onAccountsChanged(accounts: string[]): void {
    if (accounts.length === 0) this.emit("disconnect");
    else this.emit("change", { account: accounts[0] as `0x${string}` });
  }

  protected override isChainUnsupported(chainId: number): boolean {
    return !this.chains.some((x) => x.id === chainId);
  }

  protected onChainChanged(chainId: string | number): void {
    const id = normalizeChainId(chainId);
    const unsupported = this.isChainUnsupported(id);
    this.emit("change", { chain: { id, unsupported } });
  }

  protected onDisconnect(): void {
    this.emit("disconnect");
  }
}

function makeChainConfig(chain: Chain): CustomChainConfig {
  const rpcTarget: string = (() => {
    const r = chain.rpcUrls.default;
    if (r === undefined) throw new Error(`Chain ${chain.id} has no default rpcUrls`);
    const r0 = r.http[0];
    if (r0 === undefined) throw new Error(`Chain ${chain.id} has no http rpcUrls`);
    return r0;
  })()
  const blockExplorer: string = (() => {
    if (chain.blockExplorers === undefined) throw new Error(`Chain ${chain.id} has no blockExplorerUrls`);
    const b = chain.blockExplorers.default;
    if (b === undefined) throw new Error(`Chain ${chain.id} has no default block explorers`);
    return b.url;
  })();
  const nativeCurrency: NativeCurrency = (() => {
    const nc = nativeCurrencies.find(n => n.chainId === chain.id);
    if (nc === undefined) throw new Error(`Chain ${chain.id} has no nativeCurrency`);
    return nc;
  })();
  return {
    chainNamespace: CHAIN_NAMESPACES.EIP155,
    chainId: `0x${chain.id.toString(16)}`,
    rpcTarget,
    displayName: chain.name,
    blockExplorer,
    ticker: nativeCurrency.ticker,
    tickerName: nativeCurrency.name,
    decimals: nativeCurrency.decimals,
  };
}