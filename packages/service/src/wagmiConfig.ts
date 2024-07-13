import { alchemyHttpUrl, chainsSupportedBy3cities, infuraHttpUrl } from '@3cities/core';
import { createConfig, fallback, http, type Transport } from '@wagmi/core';

// TODO consider moving makeTransport to @3cities/core for shared use here and in @3cities/interface
function makeTransport(chainId: number): Transport {
  // NB fallback attempts each transport in priority order for every query, only falling back to the next transport if a query fails for the previous. Ie. by default, if a transport is unreachable for an extended period, fallback will still attempt to query it for every single query. TODO smart detection for offline transports and/or slow transports can be accessed via transport auto ranking https://viem.sh/docs/clients/transports/fallback.html#transport-ranking
  // TODO consider supporting using the connected wallet's rpc https://wagmi.sh/react/api/transports/unstable_connector --> power users may prefer that queries be routed through their wallet's rpc
  // TODO consider supporting a localhost rpc url for the L1 and perhaps other chains, so that power users running their own nodes may default to use these nodes, which is more private
  // TODO consider adding app-wide user settings for rpc urls (eg. Me -> Settings -> Network -> RPC URLs) so that non-technical users can configure their own rpcs (eg. saved on localstorage) without having to build their own copy of 3cities

  const httpOpts = {
    batch: {
      wait: 16, // milliseconds to wait for client requests to arrive before sending them all as a single batch. Default is 0 (only requests sent during the same javascript event loop are batched) however we provide a slightly longer batch wait because many of our queries are token balance fetches that are triggered by React timers that often take more than one JavaScript event loop to settle. TODO experiment with different wait times
      batchSize: 1_000, // 1_000 is the default batchSize
    }
  };

  const alchemyUrl = alchemyHttpUrl(chainId);
  const infuraUrl = infuraHttpUrl(chainId);

  return fallback([
    alchemyUrl ? http(alchemyUrl, httpOpts) : undefined,
    infuraUrl ? http(infuraUrl, httpOpts) : undefined,
    http(undefined, httpOpts), // http() with no url causes the chain's default rpc to be used
  ].filter(t => t !== undefined));
}

const transports = chainsSupportedBy3cities.reduce<{ [chainId: number]: Transport }>((ts, c) => {
  ts[c.id] = makeTransport(c.id);
  return ts;
}, {});

export const wagmiConfig = createConfig({
  chains: chainsSupportedBy3cities,
  transports,
});
