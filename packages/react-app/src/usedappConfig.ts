import { Arbitrum, ArbitrumGoerli, Config, Goerli, Mainnet, NodeUrls, Optimism, OptimismGoerli, ZkSyncTestnet } from "@usedapp/core";
import { isProduction } from "./isProduction";

const readOnlyChainId: number = isProduction ? Mainnet.chainId : Goerli.chainId;

const readOnlyUrls: NodeUrls = isProduction ? {
  [Mainnet.chainId]: `https://eth-mainnet.alchemyapi.io/v2/Ol1s45gSHsu__OExc-Yh1bfxt-DVJMXq`,
  [Optimism.chainId]: 'https://opt-mainnet.g.alchemy.com/v2/_mmH6xoATzxwTHYEpuVL_6Yf8mY_xf9H',
  [Arbitrum.chainId]: 'https://arb-mainnet.g.alchemy.com/v2/qSTX0YehhXuj-fZycDbNlNuKhN4MBGP3',
} : {
  [Goerli.chainId]: 'https://eth-goerli.g.alchemy.com/v2/FlOQbm_9tqyr6vTDiUooBl6MI2MkCdR1',
  [OptimismGoerli.chainId]: 'https://opt-goerli.g.alchemy.com/v2/65S7gxqK5X5HibXOreCUpvSODw9CFyvI',
  [ArbitrumGoerli.chainId]: 'https://arb-goerli.g.alchemy.com/v2/8n3QLxXoagfvugVAzAD7e4yyZ74T6sE1',
  [ZkSyncTestnet.chainId]: (() => {
    const s = ZkSyncTestnet.rpcUrl;
    if (s === undefined) throw "ZkSyncTestnet.rpcUrl undefined";
    return s;
  })(),
};

export const config: Config = {
  readOnlyChainId,
  readOnlyUrls,
};

// allChainIds is the set of chainIds we support, ie. the set of chainIds loaded into our usedapp config
export const allChainIds: number[] = Object.keys(readOnlyUrls).map((s) => parseInt(s, 10));
