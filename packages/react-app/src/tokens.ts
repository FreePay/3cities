import { Chain } from 'wagmi';
import { NonEmptyArray } from "./NonEmptyArray";
import { Optional } from './Optional';
import { NativeCurrency, Token, isToken } from "./Token";
import { allSupportedChainIds, arbitrum, arbitrumGoerli, arbitrumNova, base, baseGoerli, goerli, linea, lineaTestnet, mainnet, optimism, optimismGoerli, polygon, polygonMumbai, polygonZkEvm, polygonZkEvmTestnet, scroll, scrollTestnet, zkSync, zkSyncTestnet, zora } from './chains';
import { isProduction } from "./isProduction";
import { toUppercase } from './toUppercase';

// TODO switch to matrix-style token definitions, such that constants like eg. ArbitrumNovaLUSD don't need to exist, and instead, we get something like `const lusd = abstractToken({ name: 'Liquidty USD', ticker: 'LUSD', }); tokens.push(t(arbitrumNova, lusd, { c: '<contract address' }));` or perhaps `tokens.push(ts(arbitrumNova, { lusd: '<contract address'>, usdc: '<contract address>' })) --> need to consider how these succinct definitions would handle overrides, eg. if a token has a different number of definitions on one chain or a canonicalTicker --> another feature of these new definitions could be that the tokens produce their own canonical ordering given a canonical chain ordering and canonical ticker ordering: today, it's laborious to ensure that the token order (as defined by the manual order of token identifiers in the final tokens array) is consistent for all tickers/chains --> see how OP's multichain tokenlist does this https://github.com/ethereum-optimism/ethereum-optimism.github.io/blob/master/data/WETH/data.json

// TODO split out individual testnet token definitions from non-testnet defs. Eg. don't put arbitrum and arbitrumTestnet tokens in the spam block, it's spammy and hard to read. This change just reorders slocs

// TODO fill in missing tokens that require bridging when L1 gas is cheaper. Eg. USDP, PYUSD, GUSD on Arb One/Nova, and others.

// TODO consider verbose token names like {TOKEN_SYMBOL}-{NETWORK_VERBOSE_NAME}.

// ***************************************************************
const isTestShorterListOfTokens = false; // WARNING test flag to be manually toggled during develpment to cull the list of supported tokens down to a minimal set for testing purposes
// ***************************************************************

// NB the EF recommends that new app testing occur on the Sepolia
// testnet, and that validating/staking testing occur on the Goerli
// testnet. We'd prefer to follow this recommendation and use Sepolia
// for all testing. However, Sepolia currently does not have official
// testnet deployments for most of gwthe tokens and L2s we use. For
// example, none of DAI, USDT, or USDC have official deployments on
// Sepolia. So, we currently use Goerli wherever possible and don't
// use Sepolia. TODO migrate off Goerli to Sepolia
// https://ethereum.org/en/developers/docs/networks/#sepolia
// https://chainlist.org/

// WARNING currencies defined here won't actually work at runtime
// unless their chainId has a corresponding provider defined in our
// wagmi config. NB this also acts as a protective feature where
// production tokens defined here (eg. real ETH or DAI) won't work at
// all if a production provider isn't defined in the active wagmi
// config.

// NB 3cities token ticker design for bridged vs native tokens, eg. USDC is available in both bridged and native variants on many L2s. The official guidance from Circle and the L2s is that the ticker for a bridged variant is eg. "USDC.e" on Arbitrum, and that the ticker "USDC" is reserved for native variants. However, 3cities has decided to give all bridged and native variants the same "USDC" ticker and to present the Circle-recommended ticker as `tickerCanonical`. The advantages of this approach are (i) reducing ticker fragmentation, as a receiver only needs to specify they accept USDC and they will automatically accept all bridged and native variants; (ii) enhancing pay link backwards compatibility, so that existing pay links that have a ticker allowlist that includes USDC will automatically pick up all future native and bridged variants instead of permanently forbidding variants whose canonical ticker is not USDC; and (iii) supporting Ethereum's L2 model of bridging, where we don't want our supported bridged versions of tokens to be effectively second-class citizens with weird tickers.

// token is a convenience function to construct a Token for a passed Chain.
export function token(chain: Chain, { name, ticker, tickerCanonical, decimals = 18, contractAddress }: Optional<Pick<Token, 'name' | 'ticker' | 'tickerCanonical' | 'decimals' | 'contractAddress'>, 'decimals'>): Token {
  const o: Token = Object.freeze({
    name,
    ticker,
    ...(tickerCanonical && { tickerCanonical }),
    decimals,
    chainId: chain.id,
    contractAddress,
    ...(chain.testnet && { testnet: true }),
  });
  return o;
}

// nativeCurrency is a convenience function to construct a
// NativeCurrency for a passed Chain.
export function nativeCurrency(chain: Chain, args?: Pick<NativeCurrency, 'name' | 'ticker' | 'tickerCanonical'>): NativeCurrency {
  const o: NativeCurrency = Object.freeze({
    name: args?.name || 'Ether',
    ticker: args?.ticker || 'ETH',
    ...(args?.tickerCanonical && { tickerCanonical: args.tickerCanonical }),
    decimals: 18,
    chainId: chain.id,
    ...(chain.testnet && { testnet: true }),
  });
  return o;
}

// By our convention, in our token registry, every production network
// has zero or one testnets. Here, we have adopted Goerli as the
// single testnet for mainnet. See above note on Goerli vs Sepolia.

// L1 and goerli
const ETH = nativeCurrency(mainnet);
const GoerliETH = nativeCurrency(goerli);
const WETH = token(mainnet, { name: 'Wrapped Ether', ticker: 'WETH', contractAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' });
const stETH = token(mainnet, { name: 'Lido Staked Ether', ticker: 'STETH', tickerCanonical: 'stETH', contractAddress: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84' });
const GoerliWETH = token(goerli, { name: 'Wrapped Ether', ticker: 'WETH', contractAddress: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6' });
const DAI = token(mainnet, { name: 'Dai', ticker: 'DAI', contractAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F' });
const GoerliDAI = token(goerli, { name: 'Dai', ticker: 'DAI', contractAddress: '0x11fE4B6AE13d2a6055C8D9cF65c55bac32B5d844' });
const USDC = token(mainnet, { name: 'USD Coin', ticker: 'USDC', contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6 });
const GoerliUSDC = token(goerli, { name: 'USD Coin', ticker: 'USDC', contractAddress: '0x07865c6E87B9F70255377e024ace6630C1Eaa37F', decimals: 6 });
const USDT = token(mainnet, { name: 'Tether USD', ticker: 'USDT', contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6 });
const GoerliUSDT = token(goerli, { name: 'Tether USD', ticker: 'USDT', contractAddress: '0xC2C527C0CACF457746Bd31B2a698Fe89de2b6d49', decimals: 6 });
const LUSD = token(mainnet, { name: 'Liquity USD', ticker: 'LUSD', contractAddress: '0x5f98805A4E8be255a32880FDeC7F6728C6568bA0' });
const GoerliLUSD = token(goerli, { name: 'Liquity USD', ticker: 'LUSD', contractAddress: '0x1B881E518f8CA8a7ccf7e7AFA459e7303F8f5939' });
const USDP = token(mainnet, { name: 'Pax Dollar', ticker: 'USDP', contractAddress: '0x8e870d67f660d95d5be530380d0ec0bd388289e1' });
const PYUSD = token(mainnet, { name: 'PayPal USD', ticker: 'PYUSD', contractAddress: '0x6c3ea9036406852006290770bedfcaba0e23a0e8', decimals: 6 });
const GUSD = token(mainnet, { name: 'Gemini Dollar', ticker: 'GUSD', contractAddress: '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd', decimals: 2 });

// optimism and optimismGoerli
// how to add new tokens on optimism: look up the address in https://github.com/ethereum-optimism/ethereum-optimism.github.io/tree/master/data, verify decimals in same json files, and then add the token
// NB optimism bridge UI only allows a limited whitelist of tokens, excluding many of our supported tokens, but the OP Stack codebase allows programmatic bridging of any token, so if we want to have complete token definitions even beyond the official json registry above, then we could programmatically bridged from L1 to OP Mainnet and add the resulting token contract addresses here, eg. https://docs.base.org/tools/bridges#programmatic-bridging https://github.com/wilsoncusack/op-stack-bridge-example
const OptimismETH = nativeCurrency(optimism);
const OptimismGoerliETH = nativeCurrency(optimismGoerli);
const OptimismWETH = token(optimism, { name: 'Wrapped Ether', ticker: 'WETH', contractAddress: '0x4200000000000000000000000000000000000006' });
const OptimismGoerliWETH = token(optimismGoerli, { name: 'Wrapped Ether', ticker: 'WETH', contractAddress: '0x4200000000000000000000000000000000000006' });
const OptimismDAI = token(optimism, { name: 'Dai', ticker: 'DAI', contractAddress: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' });
const OptimismGoerliDAI = token(optimismGoerli, { name: 'Dai', ticker: 'DAI', contractAddress: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' });
const OptimismUSDCBridged = token(optimism, { name: 'USD Coin', ticker: 'USDC', tickerCanonical: 'USDC.e', contractAddress: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', decimals: 6 });
const OptimismUSDCNative = token(optimism, { name: 'USD Coin', ticker: 'USDC', contractAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 });
const OptimismGoerliUSDC = token(optimismGoerli, { name: 'USD Coin', ticker: 'USDC', contractAddress: '0x7E07E15D2a87A24492740D16f5bdF58c16db0c4E', decimals: 6 });
const OptimismUSDT = token(optimism, { name: 'Tether USD', ticker: 'USDT', contractAddress: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6 });
const OptimismGoerliUSDT = token(optimismGoerli, { name: 'Tether USD', ticker: 'USDT', contractAddress: '0x853eb4bA5D0Ba2B77a0A5329Fd2110d5CE149ECE', decimals: 6 });
const OptimismLUSD = token(optimism, { name: 'Liquity USD', ticker: 'LUSD', contractAddress: '0xc40F949F8a4e094D1b49a23ea9241D289B7b2819' });
// TODO OptimismGoerliLUSD
// const optimismUSDP = token(optimism, { name: 'Pax Dollar', ticker: 'USDP', contractAddress: '' }); // not currently added to optimism bridge. TODO programmatically bridge it ourselves and add it
// const optimismPYUSD = token(optimism, { name: 'PayPal USD', ticker: 'PYUSD', contractAddress: '', decimals: 6 }); // not currently added to optimism bridge. TODO programmatically bridge it ourselves and add it
// const optimismGUSD = token(optimism, { name: 'Gemini Dollar', ticker: 'GUSD', contractAddress: '', decimals: 2 }); // not currently added to optimism bridge. TODO programmatically bridge it ourselves and add it

// arbitrum and arbitrumGoerli
// how to add new tokens on arbitrum: look up the address in https://bridge.arbitrum.io/?l2ChainId=42161 (L2 token addresses can be seen without executing a bridge operation. If the L2 token address doesn't load, nobody may have bridged it yet)
const ArbitrumETH = nativeCurrency(arbitrum);
const ArbitrumGoerliETH = nativeCurrency(arbitrumGoerli);
const ArbitrumWETH = token(arbitrum, { name: 'Wrapped Ether', ticker: 'WETH', contractAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' });
const ArbitrumGoerliWETH = token(arbitrumGoerli, { name: 'Wrapped Ether', ticker: 'WETH', contractAddress: '0xe39Ab88f8A4777030A534146A9Ca3B52bd5D43A3' });
const ArbitrumDAI = token(arbitrum, { name: 'Dai', ticker: 'DAI', contractAddress: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' });
const ArbitrumGoerliDAI = token(arbitrumGoerli, { name: 'Dai', ticker: 'DAI', contractAddress: '0x8411120Df646D6c6DA15193Ebe9E436c1c3a5222' });
const ArbitrumUSDCBridged = token(arbitrum, { name: 'USD Coin', ticker: 'USDC', tickerCanonical: 'USDC.e', contractAddress: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', decimals: 6 });
const ArbitrumUSDCNative = token(arbitrum, { name: 'USD Coin', ticker: 'USDC', contractAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', decimals: 6 });
const ArbitrumGoerliUSDC = token(arbitrumGoerli, { name: 'USD Coin', ticker: 'USDC', contractAddress: '0x8FB1E3fC51F3b789dED7557E680551d93Ea9d892', decimals: 6 });
const ArbitrumUSDT = token(arbitrum, { name: 'Tether USD', ticker: 'USDT', contractAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 });
const ArbitrumGoerliUSDT = token(arbitrumGoerli, { name: 'Tether USD', ticker: 'USDT', contractAddress: '0xB401e876346B3C77DD51781Efba5223d2F1e6697', decimals: 6 });
const ArbitrumLUSD = token(arbitrum, { name: 'Liquity USD', ticker: 'LUSD', contractAddress: '0x93b346b6BC2548dA6A1E7d98E9a421B42541425b' });
const ArbitrumGoerliLUSD = token(arbitrumGoerli, { name: 'Liquity USD', ticker: 'LUSD', contractAddress: '0xF4AcA3d17F30eD982b65A33F7DD2180d9EB65c56' });

// arbitrumNova (has no testnet)
// how to add new tokens on arbitrumNova: look up the address in https://bridge.arbitrum.io/?l2ChainId=42170 (L2 token addresses can be seen without executing a bridge operation. If the L2 token address doesn't load, nobody may have bridged it yet), confirm decimals in the explorer, and then add the token
const ArbitrumNovaETH = nativeCurrency(arbitrumNova);
const ArbitrumNovaWETH = token(arbitrumNova, { name: 'Wrapped Ether', ticker: 'WETH', contractAddress: '0x722E8BdD2ce80A4422E880164f2079488e115365' });
const ArbitrumNovaDAI = token(arbitrumNova, { name: 'Dai', ticker: 'DAI', contractAddress: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' });
const ArbitrumNovaUSDC = token(arbitrumNova, { name: 'USD Coin', ticker: 'USDC', contractAddress: '0x750ba8b76187092B0D1E87E28daaf484d1b5273b', decimals: 6 });
const ArbitrumNovaUSDT = token(arbitrumNova, { name: 'Tether USD', ticker: 'USDT', contractAddress: '0xed9d63a96c27f87b07115b56b2e3572827f21646', decimals: 6 });
const ArbitrumNovaLUSD = token(arbitrumNova, { name: 'Liquity USD', ticker: 'LUSD', contractAddress: '0x14B580e57D0827D7B0F326D73AC837C51d62627D' });

// zkSync and zkSyncTestnet
// how to add new tokens on zkSync: look up address in both of https://portal.txsync.io/bridge/withdraw and https://syncswap.xyz/ and compare the two addresses, if they match, confirm decimals in explorer (https://explorer.zksync.io/), and then add the token
const zkSyncETH = nativeCurrency(zkSync);
const zkSyncTestnetETH = nativeCurrency(zkSyncTestnet);
const zkSyncWETH = token(zkSync, { name: 'Wrapped Ether', ticker: 'WETH', contractAddress: '0x5aea5775959fbc2557cc8789bc1bf90a239d9a91' });
const zkSyncUSDC = token(zkSync, { name: 'USD Coin', ticker: 'USDC', contractAddress: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', decimals: 6 });
const zkSyncUSDT = token(zkSync, { name: 'Tether USD', ticker: 'USDT', contractAddress: '0x493257fd37edb34451f62edf8d2a0c418852ba4c', decimals: 6 });
const zkSyncDAI = token(zkSync, { name: 'Dai', ticker: 'DAI', contractAddress: '0x4b9eb6c0b6ea15176bbf62841c6b2a8a398cb656' });
const zkSyncLUSD = token(zkSync, { name: 'Liquity USD', ticker: 'LUSD', contractAddress: '0x503234f203fc7eb888eec8513210612a43cf6115' });
const zkSyncTestnetUSDC = token(zkSyncTestnet, { name: 'USD Coin', ticker: 'USDC', contractAddress: '0x0faF6df7054946141266420b43783387A78d82A9', decimals: 6 });
const zkSyncTestnetDAI = token(zkSyncTestnet, { name: 'Dai', ticker: 'DAI', contractAddress: '0x3e7676937A7E96CFB7616f255b9AD9FF47363D4b' });

// scroll
// how to add new tokens on scroll: look up the address in https://scroll.io/bridge (L2 addresses can be seen in withdraw section without executing a bridge operation), verify decimals in explorer, and then add token
const scrollETH = nativeCurrency(scroll);
const scrollWETH = token(scroll, { name: 'Wrapped Ether', ticker: 'WETH', contractAddress: '0x5300000000000000000000000000000000000004' });
const scrollUSDC = token(scroll, { name: 'USD Coin', ticker: 'USDC', contractAddress: '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4', decimals: 6 });
const scrollUSDT = token(scroll, { name: 'Tether USD', ticker: 'USDT', contractAddress: '0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df', decimals: 6 });
const scrollDAI = token(scroll, { name: 'Dai', ticker: 'DAI', contractAddress: '0xcA77eB3fEFe3725Dc33bccB54eDEFc3D9f764f97' });
const scrollLUSD = token(scroll, { name: 'Liquity USD', ticker: 'LUSD', contractAddress: '0xeDEAbc3A1e7D21fE835FFA6f83a710c70BB1a051' });
// const scrollUSDP = token(scroll, { name: 'Pax Dollar', ticker: 'USDP', contractAddress: '' }); // not currently added to scroll bridge (or its underlying token list). TODO programmatically bridge it ourselves and add it
// const scrollPYUSD = token(scroll, { name: 'PayPal USD', ticker: 'PYUSD', contractAddress: '', decimals: 6 }); // not currently added to scroll bridge (or its underlying token list). TODO programmatically bridge it ourselves and add it
// const scrollGUSD = token(scroll, { name: 'Gemini Dollar', ticker: 'GUSD', contractAddress: '', decimals: 2 }); // not currently added to scroll bridge (or its underlying token list). TODO programmatically bridge it ourselves and add it

// linea
// how to add new tokens on linea: look up the address in https://syncswap.xyz/ (L2 addresses can be seen without swapping), verify decimals in explorer (https://lineascan.build), and then add token
const lineaETH = nativeCurrency(linea);
const lineaWETH = token(linea, { name: 'Wrapped Ether', ticker: 'WETH', contractAddress: '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f' });
const lineaUSDCBridged = token(linea, { name: 'USD Coin', ticker: 'USDC', tickerCanonical: 'USDC.e', contractAddress: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff', decimals: 6 });
const lineaUSDT = token(linea, { name: 'Tether USD', ticker: 'USDT', contractAddress: '0xA219439258ca9da29E9Cc4cE5596924745e12B93', decimals: 6 });
const lineaDAI = token(linea, { name: 'Dai', ticker: 'DAI', contractAddress: '0x4AF15ec2A0BD43Db75dd04E62FAA3B8EF36b00d5' });
// const lineaLUSD = token(linea, { name: 'Liquity USD', ticker: 'LUSD', contractAddress: '' }); // not currently deployed to linea. TODO bridge it ourselves and add it
// const lineaUSDP = token(linea, { name: 'Pax Dollar', ticker: 'USDP', contractAddress: '' }); // not currently deployed to linea. TODO bridge it ourselves and add it
// const lineaPYUSD = token(linea, { name: 'PayPal USD', ticker: 'PYUSD', contractAddress: '', decimals: 6 }); // not currently deployed to linea. TODO bridge it ourselves and add it
// const lineaGUSD = token(linea, { name: 'Gemini Dollar', ticker: 'GUSD', contractAddress: '', decimals: 2 }); // not currently deployed to linea. TODO bridge it ourselves and add it

// zora
const zoraETH = nativeCurrency(zora);
// TODO zora does not yet officially support any tokens, they are an ETH-only network. They are based on OP Stack, so we could bridge ERC20s ourselves, but nobody is using them rn, so there's no point.


// polygonZkEvm and polygonZkEvmTestnet
// mainnet bridge https://portal.polygon.technology/bridge
// how to add new tokens on polygonZkEvm: swap into them on https://www.sushi.com/swap?chainId=1101&token0=NATIVE, and look up new balances in explorer (https://zkevm.polygonscan.com/), verify decimals, and then add tokens
const PolygonZkEvmETH = nativeCurrency(polygonZkEvm);
const PolygonZkEvmTestnetETH = nativeCurrency(polygonZkEvmTestnet);
const PolygonZkEvmWETH = token(polygonZkEvm, { name: 'Wrapped Ether', ticker: 'WETH', contractAddress: '0x4F9A0e7FD2Bf6067db6994CF12E4495Df938E6e9' });
const PolygonZkEvmTestnetWETH = token(polygonZkEvmTestnet, { name: 'Wrapped Ether', ticker: 'WETH', contractAddress: '0x3ce1bab7b7bAE26775F81Ee3576a99f0EAd5B33C' });
const PolygonZkEvmUSDC = token(polygonZkEvm, { name: 'USD Coin', ticker: 'USDC', contractAddress: '0xA8CE8aee21bC2A48a5EF670afCc9274C7bbbC035', decimals: 6 });
const PolygonZkEvmUSDT = token(polygonZkEvm, { name: 'Tether USD', ticker: 'USDT', contractAddress: '0x1E4a5963aBFD975d8c9021ce480b42188849D41d', decimals: 6 });
const PolygonZkEvmDAI = token(polygonZkEvm, { name: 'Dai', ticker: 'DAI', contractAddress: '0xC5015b9d9161Dca7e18e32f6f25C4aD850731Fd4' });
const PolygonZkEvmLUSD = token(polygonZkEvm, { name: 'Liquity USD', ticker: 'LUSD', contractAddress: '0x01E9A866c361eAd20Ab4e838287DD464dc67A50e' });


// baseGoerli
const BaseGoerliETH = nativeCurrency(baseGoerli);
const BaseGoerliDAI = token(baseGoerli, { name: 'Dai', ticker: 'DAI', contractAddress: '0x7805e80523536fb4872a1cee2c53c4f354953b96' });

// base
// how to add new tokens on base: look up the address in https://github.com/ethereum-optimism/ethereum-optimism.github.io/tree/master/data, verify decimals in same json files, and then add the token
// NB base bridge UI only allows a limited whitelist of tokens, excluding many of our supported tokens, but base's OP Stack codebase allows programmatic bridging of any token, so if we want to have complete token definitions even beyond the official json registry above, then we could programmatically bridged from L1 to Base and add the resulting token contract addresses here https://docs.base.org/tools/bridges#programmatic-bridging https://github.com/wilsoncusack/op-stack-bridge-example
const baseETH = nativeCurrency(base);
const baseWETH = token(base, { name: 'Wrapped Ether', ticker: 'WETH', contractAddress: '0x4200000000000000000000000000000000000006' });
const baseUSDCBridged = token(base, { name: 'USD Coin', ticker: 'USDC', tickerCanonical: 'USDbC', contractAddress: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', decimals: 6 });
const baseUSDCNative = token(base, { name: 'USD Coin', ticker: 'USDC', contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 });
// const baseUSDT = token(base, { name: 'Tether USD', ticker: 'USDT', contractAddress: '', decimals: 6 }); // not currently added to the base tokenlist. TODO bridge it ourselves and add it
const baseDAI = token(base, { name: 'Dai', ticker: 'DAI', contractAddress: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' });
// const baseLUSD = token(base, { name: 'Liquity USD', ticker: 'LUSD', contractAddress: '' }); // not currently added to the base tokenlist. TODO bridge it ourselves and add it
// const baseUSDP = token(base, { name: 'Pax Dollar', ticker: 'USDP', contractAddress: '' }); // not currently added to base bridge. TODO programmatically bridge it ourselves and add it
// const basePYUSD = token(base, { name: 'PayPal USD', ticker: 'PYUSD', contractAddress: '', decimals: 6 }); // not currently added to base bridge. TODO programmatically bridge it ourselves and add it
// const baseGUSD = token(base, { name: 'Gemini Dollar', ticker: 'GUSD', contractAddress: '', decimals: 2 }); // not currently added to base bridge. TODO programmatically bridge it ourselves and add it

// linea (mainnet not yet launched) and lineaTestnet
const lineaTestnetETH = nativeCurrency(lineaTestnet);
const lineaTestnetUSDC = token(lineaTestnet, { name: 'USD Coin', ticker: 'USDC', contractAddress: '0x964FF70695da981027c81020B1c58d833D49A640', decimals: 6 });

// scrollTestnet (goerli alpha. mainnet not yet launched)
const ScrollTestnetETH = nativeCurrency(scrollTestnet);
const ScrollTestnetUSDC = token(scrollTestnet, { name: 'USD Coin', ticker: 'USDC', contractAddress: '0xa0d71b9877f44c744546d649147e3f1e70a93760' }); // NB this particular test USDC has 18 decimals instead of USDC's usual 6
const ScrollTestnetDAI = token(scrollTestnet, { name: 'Dai', ticker: 'DAI', contractAddress: '0x3dF3514437FcdF5c4F714b7025b625b9Acb3e9E1' }); // this is a random DAI plucked from the explorer and isn't listed in the scroll bridge

// polygon and polygonMumbai
// https://github.com/maticnetwork/polygon-token-list
const polygonMATIC = nativeCurrency(polygon, { name: 'Matic', ticker: 'MATIC' });
const polygonMumbaiMATIC = nativeCurrency(polygonMumbai, { name: 'Matic', ticker: 'MATIC' });
const polygonETH = token(polygon, { name: 'Ether', ticker: 'ETH', contractAddress: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619' }); // remember, ETH is an erc20 on polygon
const polygonMumbaiETH = token(polygonMumbai, { name: 'Ether', ticker: 'ETH', contractAddress: '0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa' }); // remember, ETH is an erc20 on polygon
const polygonDAI = token(polygon, { name: 'Dai', ticker: 'DAI', contractAddress: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063' });
const polygonMumbaiDAI = token(polygonMumbai, { name: 'Dai', ticker: 'DAI', contractAddress: '0xfe4F5145f6e09952a5ba9e956ED0C25e3Fa4c7F1' }); // this isn't actually DAI, it's a generic ERC20
const polygonUSDCBridged = token(polygon, { name: 'USD Coin', ticker: 'USDC', tickerCanonical: 'USDC.e', contractAddress: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', decimals: 6 });
const polygonUSDCNative = token(polygon, { name: 'USD Coin', ticker: 'USDC', contractAddress: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', decimals: 6 });
// const polygonMumbaiUSDC = token(polygonMumbai, { name: 'USD Coin', ticker: 'USDC', contractAddress: '', decimals: 6 });
const polygonUSDT = token(polygon, { name: 'Tether USD', ticker: 'USDT', contractAddress: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', decimals: 6 });
// const polygonMumbaiUSDT = token(polygonMumbai, { name: 'Tether USD', ticker: 'USDT', contractAddress: '', decimals: 6 });
const polygonLUSD = token(polygon, { name: 'Liquity USD', ticker: 'LUSD', contractAddress: '0x23001f892c0C82b79303EDC9B9033cD190BB21c7' });
// const polygonMumbaiLUSD = token(polygonMumbai, { name: 'Liquity USD', ticker: 'LUSD', contractAddress: '' });

function isTokenOnASupportedChain(t: NativeCurrency | Token): boolean {
  return allSupportedChainIds.indexOf(t.chainId) > -1;
}

// nativeCurrencies is our static global definition of all supported
// native currencies for all supported chains.
export const nativeCurrencies: Readonly<NonEmptyArray<NativeCurrency>> = (() => {
  const ts = (isProduction ? [
    ETH,
    OptimismETH,
    ArbitrumETH,
    ArbitrumNovaETH,
    zkSyncETH,
    scrollETH,
    lineaETH,
    zoraETH,
    PolygonZkEvmETH,
    baseETH,
    polygonMATIC,
  ] : [
    GoerliETH,
    OptimismGoerliETH,
    ArbitrumGoerliETH,
    zkSyncTestnetETH,
    PolygonZkEvmTestnetETH,
    BaseGoerliETH,
    lineaTestnetETH,
    ScrollTestnetETH,
    polygonMumbaiMATIC,
  ]).filter(isTokenOnASupportedChain); // here we must drop tokens on unsupported chains to ensure that all tokens in our registry are in fact on supported chains so that our token and chain registries are consistent with each other
  const t0 = ts[0];
  if (t0 === undefined) throw new Error(`nativeCurrencies: set of supported nativeCurrencies is empty`);
  else return [t0, ...ts.slice(1)];
})();

// tokens is our static global definition of all supported erc20 tokens for all supported chains.
export const tokens: Readonly<NonEmptyArray<Token>> = (() => {
  const ts = (isProduction ? [
    // Here we group the tokens by ticker and not chain because `tokens` is used to generate the canonical token ordering in allTokenKeys and our supposition is that in a multichain UX, the user would rather see all their DAIs together than all their Optimism assets, although this is somewhat contrary to how the rest of the ecosystem works right now where most apps support connecting to only one chain at a time and so naturally render all assets for one chain, effectively sorting by chain before ticker
    polygonETH, // NB ETH is a token on polygon PoS, so we list it before WETH
    // WETH zero'th, as it's a native currency
    WETH,
    OptimismWETH,
    ArbitrumWETH,
    ArbitrumNovaWETH,
    zkSyncWETH,
    scrollWETH,
    lineaWETH,
    baseWETH,
    PolygonZkEvmWETH,
    // stETH after WETH, as it's the most popular ETH-pegged token
    stETH,
    // USDC first among stablecoins, as it's most popular
    USDC,
    OptimismUSDCBridged,
    OptimismUSDCNative,
    ArbitrumUSDCBridged,
    ArbitrumUSDCNative,
    ArbitrumNovaUSDC,
    zkSyncUSDC,
    scrollUSDC,
    lineaUSDCBridged,
    baseUSDCBridged,
    baseUSDCNative,
    PolygonZkEvmUSDC,
    polygonUSDCBridged,
    polygonUSDCNative,
    // USDT second, as it's second most popular
    USDT,
    OptimismUSDT,
    ArbitrumUSDT,
    ArbitrumNovaUSDT,
    zkSyncUSDT,
    scrollUSDT,
    lineaUSDT,
    PolygonZkEvmUSDT,
    polygonUSDT,
    // DAI third, as it's third most popular
    DAI,
    OptimismDAI,
    ArbitrumDAI,
    ArbitrumNovaDAI,
    zkSyncDAI,
    scrollDAI,
    lineaDAI,
    baseDAI,
    PolygonZkEvmDAI,
    polygonDAI,
    // LUSD fourth, as it's the only other one we support rn
    LUSD,
    OptimismLUSD,
    ArbitrumLUSD,
    ArbitrumNovaLUSD,
    zkSyncLUSD,
    scrollLUSD,
    PolygonZkEvmLUSD,
    polygonLUSD,
    // Other stablecoins are prioritized by market cap:
    // USDP
    USDP,
    // PYUSD
    PYUSD,
    // GUSD
    GUSD,
  ] : [
    // WETH zero'th, as it's a native currency
    GoerliWETH,
    OptimismGoerliWETH,
    ArbitrumGoerliWETH,
    PolygonZkEvmTestnetWETH,
    polygonMumbaiETH,
    // USDC first, as it's most popular
    GoerliUSDC,
    OptimismGoerliUSDC,
    ArbitrumGoerliUSDC,
    zkSyncTestnetUSDC,
    lineaTestnetUSDC,
    ScrollTestnetUSDC,
    // USDT second, as it's second most popular
    GoerliUSDT,
    OptimismGoerliUSDT,
    ArbitrumGoerliUSDT,
    // DAI third, as it's third most popular
    GoerliDAI,
    OptimismGoerliDAI,
    ArbitrumGoerliDAI,
    zkSyncTestnetDAI,
    ScrollTestnetDAI,
    BaseGoerliDAI,
    polygonMumbaiDAI,
    // LUSD fourth, as it's the only other one we support rn
    GoerliLUSD,
    ArbitrumGoerliLUSD,
  ].filter((t) => !isTestShorterListOfTokens || t.ticker === 'USDC') // ie. drop all tokens but one ticker if this test flag is set to help test with a shorter list of tokens
  ).filter(isTokenOnASupportedChain); // here we must drop tokens on unsupported chains to ensure that all tokens in our registry are in fact on supported chains so that our token and chain registries are consistent with each other
  const t0 = ts[0];
  if (t0 === undefined) throw new Error(`tokens: set of supported tokens is empty`);
  else return [t0, ...ts.slice(1)];
})();

export type TokenKey = string // see getTokenKey

// getTokenKey returns a string that uniquely identifies the passed
// NativeCurrency or Token, suitable to be used as a hashing or object
// key.
export function getTokenKey(t: NativeCurrency | Token): TokenKey {
  return isToken(t) ? `${t.contractAddress}-${t.chainId}` : `${t.ticker}-${t.chainId}`; // WARNING here we must use the contractAddress to uniquely identify a token because we support multiple tokens with the same ticker on the same chain
}

// allTokenKeys is a list of all TokenKeys for both nativeCurrencies
// and tokens that also provides a canonical ordering of all TokenKeys
// to help clients display tokens in a deterministic, stable order.
export const allTokenKeys: Readonly<TokenKey[]> = (() => {
  const tks: TokenKey[] = [];
  for (const nc of nativeCurrencies) {
    tks.push(getTokenKey(nc));
  }
  for (const t of tokens) {
    tks.push(getTokenKey(t));
  }
  return tks;
})();

const allTokenKeysSet: Set<TokenKey> = new Set(allTokenKeys);

// isTokenSupported returns true iff the passed token is supported by
// 3cities in our global token registry. An unsupported token may be due
// to eg. an unsupported chain, or eg. a supported chain but an
// unsupported token on that chain. There may be multiple root causes as
// to why a token ends up being unsupported. One root cause may be that
// a CheckoutSettings was serialized with a Token that was on a
// supported chain, but now it's been deserialized in a context where
// that chain is no longer supported (eg. Token constructed in
// production but deserialized in test). Another root cause may be that
// the Token may have been maliciously constructed by an attacker to try
// to get a user to send an unsupported token.
export function isTokenSupported(t: NativeCurrency | Token): boolean {
  return allTokenKeysSet.has(getTokenKey(t));
}

const tokensByTokenKey: Readonly<{ [tk: TokenKey]: NativeCurrency | Token }> = (() => {
  const r: { [tk: TokenKey]: NativeCurrency | Token } = {};
  for (const nc of nativeCurrencies) {
    r[getTokenKey(nc)] = nc;
  }
  for (const t of tokens) {
    r[getTokenKey(t)] = t;
  }
  return r;
})();

// tokensByTicker is a look-up table of the set of canonical
// Token/NativeCurrency instances for each token ticker. Eg.
// tokensByTicker['DAI'] = [/* DAI instances on all chains */]
export const tokensByTicker: Readonly<{ [ticker: Uppercase<string>]: NonEmptyArray<NativeCurrency | Token> }> = (() => {
  const r: { [ticker: Uppercase<string>]: NonEmptyArray<NativeCurrency | Token> } = {};
  for (const nc of nativeCurrencies) {
    const e = r[nc.ticker];
    if (e === undefined) r[nc.ticker] = [nc];
    else e.push(nc);
  }
  for (const t of tokens) {
    const e = r[t.ticker];
    if (e === undefined) r[t.ticker] = [t];
    else e.push(t);
  }
  return r;
})();

// allTokenTickers is the set of all token and native currency tickers
// we support
export const allTokenTickers: Uppercase<string>[] = Object.keys(tokensByTicker).map(toUppercase); // here we must map toUppercase because Object.keys loses the type information that tokensByTicker tickers are Uppercase<string>

// getTokenByTokenKey returns a NativeCurrency or Token for the passed
// TokenKey. For convenience, getTokenByTokenKey is a partial function
// that throws an error if the passed TokenKey is not found in the
// global cache. Alternatively, getTokenByTokenKey could have returned
// `NativeCurrency | Token | undefined` which would be less
// convenient.
export function getTokenByTokenKey(tk: TokenKey): NativeCurrency | Token {
  const t = tokensByTokenKey[tk];
  if (t === undefined) throw new Error(`getTokenByTokenKey: unknown TokenKey: ${tk}`);
  return t;
}

// Sanity tests:
// TODO conditional compilation of these sanity tests using macros. Compile them in dev, prod-test (to be released at test.3cities.xyz), and prod-preview (a new environment and released at preview.3cities.xyz. preview is a production environment with the only difference between preview and prod being REACT_APP_ENABLE_SANITY_TESTS=true).
if (isToken(ETH)) throw new Error(`isToken implementation error: ETH recognized as a token`);
if (!isToken(WETH)) throw new Error(`isToken implementation error: WETH not recognized as a token`);
if (tokens.find(t => !(
  (isProduction && t.testnet === undefined)
  || (!isProduction && t.testnet === true)
)) !== undefined) {
  console.error(tokens);
  throw new Error(`testnet flag is not set correctly for all tokens`);
}
if (nativeCurrencies.find(nc => !(
  (isProduction && nc.testnet === undefined)
  || (!isProduction && nc.testnet === true)
)) !== undefined) {
  console.error(nativeCurrencies);
  throw new Error(`testnet flag is not set correctly for all native currencies`)
}
if (tokens.find(t => t.ticker === 'WETH' && t.decimals !== 18) !== undefined) {
  console.error(tokens);
  throw new Error(`not all WETH tokens had decimals=18`);
}
if (tokens.find(t => t.ticker === 'USDC' && t.decimals !== 6 && t.chainId !== scrollTestnet.id) !== undefined) { // for scrollTestnet, the USDC instance we're using actually has 18 decimals
  console.error(tokens);
  throw new Error(`not all USDC tokens had decimals=6`);
}
if (tokens.find(t => t.ticker === 'USDT' && t.decimals !== 6) !== undefined) {
  console.error(tokens);
  throw new Error(`not all USDT tokens had decimals=6`);
}
if (tokens.find(t => t.ticker === 'DAI' && t.decimals !== 18) !== undefined) {
  console.error(tokens);
  throw new Error(`not all DAI tokens had decimals=18`);
}
if (tokens.find(t => t.ticker === 'LUSD' && t.decimals !== 18) !== undefined) {
  console.error(tokens);
  throw new Error(`not all LUSD tokens had decimals=18`);
}
if (tokens.find(t => t.ticker === 'PYUSD' && t.decimals !== 6) !== undefined) {
  console.error(tokens);
  throw new Error(`not all PYUSD tokens had decimals=6`);
}
if (tokens.find(t => t.ticker === 'GUSD' && t.decimals !== 2) !== undefined) {
  console.error(tokens);
  throw new Error(`not all GUSD tokens had decimals=2`);
}
// if (isProduction) allSupportedChainIds.forEach(chainId => { // ensure all supported tokens are defined on all supported chains, including native currencies. Run in production only as not all tokens are defined on all chains in testnet
//   // TODO ensure this reports missing native currencies (as I accidentally once omitted a native currency)
//   const ignoreOnAllChains = Symbol("IgnoreOnAllChains");
//   const tickersToIgnoreChecking: { [ticker: Uppercase<string>]: number[] | typeof ignoreOnAllChains } = {
//     MATIC: ignoreOnAllChains, // we support MATIC only as the native token of polygon PoS and not on other chains
//     WETH: [
//       zora.id,
//       polygon.id, // polygon PoS doesn't have WETH because ETH is already a token because MATIC is the native token
//     ],
//     STETH: ignoreOnAllChains, // stETH is only rebasing and pegged to ETH on the L1, and we don't yet support non-rebasing wstETH
//     USDC: [
//       zora.id,
//     ],
//     USDT: [
//       zora.id,
//       base.id,
//     ],
//     DAI: [
//       zora.id,
//     ],
//     LUSD: [
//       linea.id,
//       zora.id,
//       base.id,
//     ],
//     USDP: [
//       arbitrum.id,
//       arbitrumNova.id,
//       optimism.id,
//       zkSync.id,
//       scroll.id,
//       linea.id,
//       zora.id,
//       base.id,
//       polygon.id,
//       polygonZkEvm.id,
//     ],
//     PYUSD: [
//       arbitrum.id,
//       arbitrumNova.id,
//       optimism.id,
//       zkSync.id,
//       scroll.id,
//       linea.id,
//       zora.id,
//       base.id,
//       polygon.id,
//       polygonZkEvm.id,
//     ],
//     GUSD: [
//       arbitrum.id,
//       arbitrumNova.id,
//       optimism.id,
//       zkSync.id,
//       scroll.id,
//       linea.id,
//       zora.id,
//       base.id,
//       polygon.id,
//       polygonZkEvm.id,
//     ],
//   }
//   allTokenTickers.forEach(ticker => {
//     const ig = tickersToIgnoreChecking[ticker];
//     const isFound = [...tokens, ...nativeCurrencies].find(t => t.chainId === chainId && t.ticker === ticker) !== undefined;
//     if (!isFound && !(ig !== undefined && (ig === ignoreOnAllChains || ig.includes(chainId)))) {
//       console.error(`token missing: ${ticker} on ${getChain(chainId)?.name} ${chainId}`);
//     } else if (isFound && ig !== undefined && ig !== ignoreOnAllChains && ig.includes(chainId)) { // sanity check to ensure that specific (ticker, chainId) are removed from tickersToIgnoreChecking as the tickers are added
//       console.error(`token ${ticker} on ${getChain(chainId)?.name} ${chainId} is errogenously registered in tickersToIgnoreChecking`);
//     }
//   });
// });
