import { BigNumber } from "@ethersproject/bignumber";
import { arbitrum, arbitrumGoerli, mainnet, optimism, polygon } from '@wagmi/core/chains';
import { StrategyPreferences } from "./StrategyPreferences";
import { NativeCurrency, Token, isToken } from "./Token";
import { AddressContext, canAfford } from "./addressContext";
import { Agreement, Payment, ProposedAgreement, isPayment, isReceiverProposedPayment } from "./agreements";
import { arbitrumNova, chainsSupportedBy3cities, polygonZkEvm, zkSync } from "./chains";
import { isProduction } from "./isProduction";
import { convertLogicalAssetUnits } from "./logicalAssets";
import { getNativeCurrenciesAndTokensForLogicalAssetTicker } from "./logicalAssetsToTokens";
import { TokenTransfer, TokenTransferForNativeCurrency, TokenTransferForToken } from "./tokenTransfer";
import { allTokenTickers, getTokenKey, isTokenSupported } from "./tokens";

// TODO consider replacing "Strategy" with "PaymentMethod" in every context

// isTokenPermittedByStrategyPreferences returns true iff the passed
// strategy preferences permits the passed token to be included in
// strategy generation.
function isTokenPermittedByStrategyPreferences(prefs: StrategyPreferences, token: NativeCurrency | Token): boolean {
  if (prefs.tokenTickerExclusions && prefs.tokenTickerExclusions.indexOf(token.ticker) > -1) return false; // WARNING ~O(N^2) when used in a list of tokens, if data size grows, in future we may want to convert tokenTickerExclusions to a map { [ticker: string]: true }
  else if (prefs.chainIdExclusions && prefs.chainIdExclusions.indexOf(token.chainId) > -1) return false; // WARNING ~O(N^2) when used in a list of tokens, if data size grows, in future we may want to convert chainIdExclusions to a map { [chainId: number]: true }
  else return true;
}


// Strategy represents one plan (ie. strategic alternative) that is
// sufficient to fulfill the agreement contained in this strategy. The
// idea here is for an agreement to generate a set of strategies, and
// then the user picks one of the strategies to execute.
export type Strategy = {
  agreement: Agreement, // the agreement which is being fulfilled by this strategy
  tokenTransfer: TokenTransfer, // the single token transfer which, once completed, will represent the execution of this agreement. NB here we have restricted the concept of which actions a strategy may take to single token transfers. In future it might become appropriate for Strategy to have a more complex relationship with the actions it describes, eg. `tokenTransfers: TokenTransfer[]`, `actions: (TokenTransfer | FutureType)[]`, etc.
}

// ReceiverProposedTokenTransfer is a TokenTransfer that's been
// proposed by the receiver, ie. it lacks a sender.
export type ReceiverProposedTokenTransfer = Omit<TokenTransfer, 'fromAddress'>

// ProposedStrategy is a draft proposal to take actions sufficient to
// fulfill the proposed agreement between at least one concrete
// participant and at least one unspecified participant. The idea here
// is that given a proposed agreement hasn't yet been accepted by the
// counterparty(ies), the function of a proposed strategy is to say,
// "let me help you make a decision and motivate you to accept the
// agreement by showing you an example of the actions you could take to
// fulfill this agreement".
export type ProposedStrategy = {
  proposedAgreement: ProposedAgreement, // the proposed agreement which this proposed strategy may end up fulfilling fulfill if the proposal is accepted
  receiverProposedTokenTransfer: ReceiverProposedTokenTransfer, // the single proposed token transfer which, once accepted and completed, will represent the execution of this agreement. See design note on Strategy.tokenTransfer
}

// getProposedStrategiesForProposedAgreement computes the proposed
// strategies for the passed proposed agreement, taking into account
// the passed strategy preferences.
export function getProposedStrategiesForProposedAgreement(prefs: StrategyPreferences, pa: ProposedAgreement): ProposedStrategy[] {
  const pss: ProposedStrategy[] = [];
  if (isReceiverProposedPayment(pa)) {
    const ts = getNativeCurrenciesAndTokensForLogicalAssetTicker(pa.logicalAssetTicker);
    pss.push(...ts
      .filter(isTokenSupported)
      .filter(isTokenPermittedByStrategyPreferences.bind(null, prefs))
      .map(token => {
        return {
          proposedAgreement: pa,
          receiverProposedTokenTransfer: {
            toAddress: pa.toAddress,
            token,
            amountAsBigNumberHexString: convertLogicalAssetUnits(BigNumber.from(pa.amountAsBigNumberHexString), token.decimals).toHexString(),
          },
        };
      }));
  }
  // TODO support generation of strategies based on exchange rates, eg. if payment is for $5 USD then we should support a strategy of paying $5 in ETH and vice versa
  // console.log("getProposedStrategiesForProposedAgreement prefs=", prefs, "pa=", pa, "r=", pss);
  return sortProposedStrategiesByPriority(staticChainIdPriority, staticTokenTickerPriority, pss);
}

// getStrategiesForAgreement computes the strategies for the passed
// agreement, taking into account the passed strategy preferences and
// address context.
// TODO WARNING today, the set of strategies computed for an Agreement runs the algorithm below, and that's a separate algorithm than the set of proposed strategies computed for a ProposedAgreement in getProposedStrategiesForProposedAgreement --> perhaps instead, there should be a single strategy generator shared by both functions --> next step is to think about and write down the tradeoffs/examples here... are there situations where an Agreement and ProposedAgreement should generate very different strategies, or can they usually/always share a strategy generation algorithm?
export function getStrategiesForAgreement(prefs: StrategyPreferences, a: Agreement, ac: AddressContext): Strategy[] {
  const ss: Strategy[] = [];
  if (isPayment(a)) {
    const ts = getNativeCurrenciesAndTokensForLogicalAssetTicker(a.logicalAssetTicker);
    ss.push(...ts
      .filter(isTokenSupported)
      .filter(isTokenPermittedByStrategyPreferences.bind(null, prefs))
      .map(token => {
        const s: Strategy = {
          agreement: a,
          tokenTransfer: unsafeMakeTokenTransferForPaymentAndToken(a, token),
        };
        return s;
      })
      .filter(s => canAfford(ac, getTokenKey(s.tokenTransfer.token), s.tokenTransfer.amountAsBigNumberHexString)) // having already generated the set of possible strategies (which were already filtered to obey strategy preferences), we now further filter the strategies to accept only those affordable by the passed address context. Ie. here is where we ensure that the computed strategies are affordable by the payor
    );
  }
  // TODO support generation of strategies based on exchange rates, eg. if payment is for $5 USD then we should support a strategy of paying $5 in ETH and vice versa
  // console.log("getStrategiesForAgreement prefs=", prefs, "a=", a, "r=", ss);
  return sortStrategiesByPriority(staticChainIdPriority, staticTokenTickerPriority, ss);
}

// unsafeMakeTokenTransferForPaymentAndToken constructs a TokenTransfer
// for the passed Payment and Token. Precondition: the passed payment
// can be settled in the passed token. Ie. this function is marked
// unsafe because of the constrictive precondition that the client must
// have already safely determined that the passed payment can be settled
// in the passed token.
function unsafeMakeTokenTransferForPaymentAndToken(p: Payment, token: Token | NativeCurrency): TokenTransfer {
  const ttPartial: Omit<TokenTransfer, 'token'> = {
    toAddress: p.toAddress,
    fromAddress: p.fromAddress,
    amountAsBigNumberHexString: convertLogicalAssetUnits(BigNumber.from(p.amountAsBigNumberHexString), token.decimals).toHexString(),
  };
  // The following curious block of code is needed because until the type guard isToken is executed, TypeScript can't infer that `token` is assignable to TokenTransfer.token:
  if (isToken(token)) {
    const tt: TokenTransferForToken = Object.assign(ttPartial, { token });
    return tt;
  } else {
    const tt: TokenTransferForNativeCurrency = Object.assign(ttPartial, { token });
    return tt;
  }
}

type ChainIdPriority = {
  [chainId: number]: number;
};

type TokenTickerPriority = {
  [ticker: string]: number;
};

function sortStrategiesByPriority(
  chainIdPriority: ChainIdPriority,
  tokenTickerPriority: TokenTickerPriority,
  strategies: Strategy[],
): Strategy[] {
  return strategies.sort((a, b) => {
    const aChainId = a.tokenTransfer.token.chainId;
    const bChainId = b.tokenTransfer.token.chainId;
    const aPriority = chainIdPriority[aChainId] ?? Number.NEGATIVE_INFINITY;
    const bPriority = chainIdPriority[bChainId] ?? Number.NEGATIVE_INFINITY;
    if (aPriority === bPriority) {
      const aTicker = a.tokenTransfer.token.ticker;
      const bTicker = b.tokenTransfer.token.ticker;
      const aTickerPriority = tokenTickerPriority[aTicker] ?? Number.NEGATIVE_INFINITY;
      const bTickerPriority = tokenTickerPriority[bTicker] ?? Number.NEGATIVE_INFINITY;
      return bTickerPriority - aTickerPriority;
    } else return bPriority - aPriority;
  });
}

// TODO unify sortStrategiesByPriority and sortProposedStrategiesByPriority instead of just copying the code?
function sortProposedStrategiesByPriority(
  chainIdPriority: ChainIdPriority,
  tokenTickerPriority: TokenTickerPriority,
  proposedStrategies: ProposedStrategy[],
): ProposedStrategy[] {
  return proposedStrategies.sort((a, b) => {
    const aChainId = a.receiverProposedTokenTransfer.token.chainId;
    const bChainId = b.receiverProposedTokenTransfer.token.chainId;
    const aPriority = chainIdPriority[aChainId] ?? Number.NEGATIVE_INFINITY;
    const bPriority = chainIdPriority[bChainId] ?? Number.NEGATIVE_INFINITY;
    if (aPriority === bPriority) {
      const aTicker = a.receiverProposedTokenTransfer.token.ticker;
      const bTicker = b.receiverProposedTokenTransfer.token.ticker;
      const aTickerPriority = tokenTickerPriority[aTicker] ?? Number.NEGATIVE_INFINITY;
      const bTickerPriority = tokenTickerPriority[bTicker] ?? Number.NEGATIVE_INFINITY;
      return bTickerPriority - aTickerPriority;
    } else return bPriority - aPriority;
  });
}

const staticChainIdPriority: ChainIdPriority = {
  // Here we attempt to prioritize chains with lower fees. Of course,
  // fee structures are always changing, and fees can differ for more
  // complex reasons, so this is just a start.

  // This is intended to be a complete set of prioritized production networks (higher priority is better):
  [arbitrumNova.id]: 1000,
  [arbitrum.id]: 900,
  [optimism.id]: 800,
  [polygonZkEvm.id]: 750,
  [zkSync.id]: 700,
  [polygon.id]: 500,
  [mainnet.id]: 1,

  // Testnet priorities below here (higher priority is better):
  [arbitrumGoerli.id]: 100,
};

if (isProduction) chainsSupportedBy3cities.forEach(c => {
  if (staticChainIdPriority[c.id] === undefined) console.warn("chain not assigned a strategy priority", c);
});

const staticTokenTickerPriority: TokenTickerPriority = {
  // This is intended to be a complete set of prioritized production token tickers (higher priority is better):
  USDC: 1000, // I put USDC as top priority because I think ppl generally prefer to use it.
  LUSD: 900, // LUSD is the most decentralized stablecoin so I made it 2nd-highest priority.
  USDT: 800, // USDT is quite popular overseas so I made it 3rd-highest priority.
  DAI: 700,
  WETH: 150, // People generally want to pay with stablecoins, so non-stables have lower priority.
  ETH: 100,
  MATIC: 50,
};

if (isProduction) allTokenTickers.forEach(ticker => {
  if (staticTokenTickerPriority[ticker] === undefined) console.warn("token ticker not assigned a strategy priority", ticker);
});
