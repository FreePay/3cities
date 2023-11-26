import { BigNumber } from "@ethersproject/bignumber";
import { AddressContext } from "./AddressContext";
import { ExchangeRates, convert } from "./ExchangeRates";
import { Intersection } from "./Intersection";
import { Payment, ProposedPayment, isPayment } from "./Payment";
import { PrimaryWithSecondaries } from "./PrimaryWithSecondaries";
import { StrategyPreferences } from "./StrategyPreferences";
import { NativeCurrency, Token, isToken } from "./Token";
import { canAfford } from "./canAfford";
import { arbitrum, arbitrumGoerli, arbitrumNova, chainsSupportedBy3cities, mainnet, optimism, polygon, polygonZkEvm, zkSync } from './chains';
import { flatMap } from "./flatMap";
import { isProduction } from "./isProduction";
import { LogicalAssetTicker, convertLogicalAssetUnits } from "./logicalAssets";
import { getAllNativeCurrenciesAndTokensForLogicalAssetTicker, getLogicalAssetTickerForTokenOrNativeCurrencyTicker } from "./logicalAssetsToTokens";
import { ProposedTokenTransfer, TokenTransfer, TokenTransferForNativeCurrency, TokenTransferForToken } from "./tokenTransfer";
import { allTokenTickers, getTokenKey, isTokenSupported } from "./tokens";

// TODO consider replacing "Strategy" with "PaymentMethod" in every context

// isTokenPermittedByStrategyPreferences returns true iff the passed
// strategy preferences permits the passed token to be included in
// strategy generation.
function isTokenPermittedByStrategyPreferences(prefs: StrategyPreferences, token: NativeCurrency | Token): boolean {
  if (prefs.acceptedTokenTickers?.denylist && prefs.acceptedTokenTickers.denylist.has(token.ticker)) return false;
  else if (prefs.acceptedTokenTickers?.allowlist && !prefs.acceptedTokenTickers.allowlist.has(token.ticker)) return false;
  else if (prefs.acceptedChainIds?.denylist && prefs.acceptedChainIds.denylist.has(token.chainId)) return false;
  else if (prefs.acceptedChainIds?.allowlist && !prefs.acceptedChainIds.allowlist.has(token.chainId)) return false;
  else return true;
}

// Strategy represents a plan (ie. strategic alternative) to take
// actions that are sufficient to settle the payment contained in this
// strategy. The idea here is for a payment to generate a set of
// strategies, and then the user picks one of the strategies to execute.
export type Strategy = Readonly<{
  payment: Payment, // the payment which is being settled by this strategy
  tokenTransfer: TokenTransfer, // the single token transfer which, once executed, will represent the settling of this payment. NB here we have restricted the concept of which actions a strategy may take to single token transfers. In future it might become appropriate for Strategy to have a more complex relationship with the actions it describes, eg. `tokenTransfers: TokenTransfer[]`, `actions: (TokenTransfer | FutureType)[]`, etc.
}>

// ProposedStrategy is a proposed plan (ie. strategic alternative) to
// take actions that are sufficient to settle the proposed payment
// contained in this proposed strategy. The idea here is that, given the
// contained proposed payment that doesn't yet have a sender, the
// proposed strategy helps say to a prospective sender, "let me help you
// make a decision and motivate you to accept this proposed payment by
// showing you an example of the actions you could take to settle this
// payment".
export type ProposedStrategy = Readonly<{
  proposedPayment: ProposedPayment, // the proposed payment which this proposed strategy may end up settling if the proposal is accepted
  proposedTokenTransfer: ProposedTokenTransfer, // the single proposed token transfer which once accepted and executed will settle the proposed payment in this proposed strategy. See design note on Strategy.tokenTransfer
}>

// getAllNativeCurrenciesAndTokensAcceptedByReceiverForPayment returns
// all native currencies and tokens which the passed (proposed)
// payment's receiver accepts to settle the passed (proposed) payment.
// Precondition: the passed receiver strategy preferences are for the
// same receiver as the passed (proposed) payment's receiver.
function getAllNativeCurrenciesAndTokensAcceptedByReceiverForPayment(receiverStrategyPreferences: StrategyPreferences, p: Intersection<Payment, ProposedPayment>): (NativeCurrency | Token)[] {
  return [
    ...getAllNativeCurrenciesAndTokensForLogicalAssetTicker(p.logicalAssetTickers.primary),
    ...p.logicalAssetTickers.secondaries.flatMap(getAllNativeCurrenciesAndTokensForLogicalAssetTicker),
  ].filter(isTokenSupported)
    .filter(isTokenPermittedByStrategyPreferences.bind(null, receiverStrategyPreferences));
}

// design note: WARNING today, generation of strategies and proposed
// strategies are disunified. The definition of the kinds of strategies
// that can be generated and their semantics are copied into both
// getStrategiesForPayment and getProposedStrategiesForProposedPayment.
// We explored two different unification approaches, but both failed.
// The first approach was to have a single strategy generation function
// that had overloaded signatures to handle strategies vs proposed
// strategies. However, TypeScript's overloaded signature capability
// isn't smart enough to detect the case of "(ProposedPayment is
// provided) xor (Payment and AddressContext are provided)". Nor is it
// smart enough to allow a local variable's type to be conditional on a
// parameter type, eg. (const generatedStrategies: Strategy[] |
// ProposedStrategy[] --> this sum type can't be conditional on whether
// or not the passed `p` is a Payment or ProposedPayment). So, the
// approach of having a single strategy generation function didn't seem
// to be typesafe and was abandoned. The second approach is to have the
// strategy generation function produce only proposed strategies, and
// then to generate strategies, we demote a Payment to a
// ProposedPayment, generate proposed strategies, and then promote the
// proposed strategies to strategies. But demoting a Payment to a
// ProposedPayment felt weird and brittle, and when promoting proposed
// strategies to strategies, there's a need to filter for strategies
// that are affordable by the sender's AddressContext, which is trivial
// for TokenTransfer strategies but may be non-trivial for future kinds
// of strategies. Eg. when we add bridging strategies, the set of
// generated bridge strategies may a non-trivial function of the
// sender's AddressContext. In short, it may be the case that strategies
// and proposed strategies are intrinsically separate concepts and will
// always remain disunified.

// getProposedStrategiesForProposedPayment computes the proposed
// strategies for the passed proposed payment, taking into account the
// passed receiver strategy preferences. Precondition: the passed
// receiver strategy preferences are for the same receiver as the passed
// proposed payment's receiver.
export function getProposedStrategiesForProposedPayment(er: ExchangeRates | undefined, receiverStrategyPreferences: StrategyPreferences, p: ProposedPayment): ProposedStrategy[] {
  const ts: (NativeCurrency | Token)[] = getAllNativeCurrenciesAndTokensAcceptedByReceiverForPayment(receiverStrategyPreferences, p);
  const pss: ProposedStrategy[] = [];

  // Generate proposed strategy type #1: ProposedTokenTransfer, ie. a
  // proposed strategy of paying via a direct token transfer on the same
  // chain. (There is currently only one type of proposed strategy)
  pss.push(...flatMap(ts, t => {
    const ptt: ProposedTokenTransfer | undefined = unsafeMakeTokenTransferForPaymentAndToken(er, p, t);
    if (!ptt) return undefined;
    else {
      const s: ProposedStrategy = {
        proposedPayment: p,
        proposedTokenTransfer: ptt,
      };
      return s;
    }
  }));

  return sortStrategiesByPriority(staticChainIdPriority, staticTokenTickerPriority, pss);
}

// getStrategiesForPayment computes the strategies for the passed
// payment, taking into account the passed receiver strategy preferences
// and sender address context. Precondition: the passed receiver
// strategy preferences are for the same receiver as the passed
// payment's receiver, and the passed sender address context is for the
// same sender as the passed payment's sender.
export function getStrategiesForPayment(er: ExchangeRates | undefined, receiverStrategyPreferences: StrategyPreferences, p: Payment, senderAddressContext: AddressContext): Strategy[] {
  const ts: (NativeCurrency | Token)[] = getAllNativeCurrenciesAndTokensAcceptedByReceiverForPayment(receiverStrategyPreferences, p);
  const ss: Strategy[] = [];

  // Generate strategy type #1: TokenTransfer, ie. a strategy of paying
  // via a direct token transfer on the same chain. (There is currently
  // only one type of strategy)
  ss.push(
    ...flatMap(ts, t => {
      const tt: TokenTransfer | undefined = unsafeMakeTokenTransferForPaymentAndToken(er, p, t);
      if (!tt) return undefined;
      else {
        const s: Strategy = {
          payment: p,
          tokenTransfer: tt,
        };
        return s;
      }
    }).filter(s => canAfford(senderAddressContext, getTokenKey(s.tokenTransfer.token), s.tokenTransfer.amountAsBigNumberHexString)) // having already generated the set of possible token transfer strategies, we now further filter these strategies to accept only those affordable by the passed sender address context. Ie. here is where we ensure that the computed token transfer strategies are affordable by the sender
  );

  return sortStrategiesByPriority(staticChainIdPriority, staticTokenTickerPriority, ss);
}

// unsafeMakeTokenTransferForPaymentAndToken constructs a TokenTransfer
// (ProposedTokenTransfer) for the passed (proposed) payment and token.
// Precondition: the passed (proposed) payment can be settled in the
// passed token. Ie. this function is marked unsafe because of the
// constrictive precondition that the client must have already safely
// determined that the passed (proposed) payment can be settled in the
// passed token.
function unsafeMakeTokenTransferForPaymentAndToken(er: ExchangeRates | undefined, p: Payment, token: Token | NativeCurrency): TokenTransfer | undefined
function unsafeMakeTokenTransferForPaymentAndToken(er: ExchangeRates | undefined, p: ProposedPayment, token: Token | NativeCurrency): ProposedTokenTransfer | undefined
function unsafeMakeTokenTransferForPaymentAndToken(er: ExchangeRates | undefined, p: Payment | ProposedPayment, token: Token | NativeCurrency): TokenTransfer | ProposedTokenTransfer | undefined
function unsafeMakeTokenTransferForPaymentAndToken(er: ExchangeRates | undefined, p: Payment | ProposedPayment, token: Token | NativeCurrency): TokenTransfer | ProposedTokenTransfer | undefined {
  if (p.paymentMode.payWhatYouWant) return undefined; // NB in "pay what you want" mode, no canonical token transfer can be derived from the Payment because there's no single specific amount to be paid. Instead, "pay what you want" mode must be handled upstream by obtaining the sender's preference(s) as to what amount(s) they may want to pay and then constructing ordinary payment(s) (that don't use "pay what you want" mode)in those amount(s), and then those ordinary payments can have canonical token transfers derived normally
  else {
    const amountDenominatedInToken: undefined | bigint = (() => {
      const amountDenominatedInPrimaryLogicalAssetWithTokensDecimals: bigint = convertLogicalAssetUnits(BigNumber.from(p.paymentMode.logicalAssetAmountAsBigNumberHexString), token.decimals).toBigInt(); // WARNING this amount is denominated in the passed Payment's primary logical asset and using the passed token's decimals. But, any exchange rate conversion that may need to be applied has not yet been applied
      const logicalAssetTickerForThisTokenTransfer: LogicalAssetTicker | undefined = getLogicalAssetTickerForTokenOrNativeCurrencyTicker(token.ticker);
      if (logicalAssetTickerForThisTokenTransfer === undefined) {
        // case 1. the passed token is not supported by any logical asset. For example, UNI's is not supported by any logical asset because 1 unit of UNI is not pegged to any logical asset. Since the token transfer we're attempting to construct is not supported by any logical asset, we'll attempt an exchange rate conversion directly from the Payment's primary logical asset to the token
        if (er === undefined) return undefined;
        else {
          const _amountDenominatedInToken: undefined | bigint = convert({ er, fromTicker: p.logicalAssetTickers.primary, toTicker: token.ticker, fromAmount: amountDenominatedInPrimaryLogicalAssetWithTokensDecimals });
          return _amountDenominatedInToken;
        }
      } else if (logicalAssetTickerForThisTokenTransfer === p.logicalAssetTickers.primary) {
        // case 2. the passed token is supported by the passed payment's primary logical asset, and no exchange rate conversion is needed
        return amountDenominatedInPrimaryLogicalAssetWithTokensDecimals;
      } else {
        // case 3. the passed token is supported by a logical asset other than the passed payment's primary logical asset, so exchange rate conversion between the two logical assets is needed
        if (er === undefined) return undefined;
        else {
          const _amountDenominatedInToken: undefined | bigint = convert({ er, fromTicker: p.logicalAssetTickers.primary, toTicker: logicalAssetTickerForThisTokenTransfer, fromAmount: amountDenominatedInPrimaryLogicalAssetWithTokensDecimals });
          return _amountDenominatedInToken;
        }
      }
    })();
    if (amountDenominatedInToken === undefined) return undefined;
    else {
      const ttPartial: Pick<Intersection<TokenTransfer, ProposedTokenTransfer>, 'amountAsBigNumberHexString'> = {
        amountAsBigNumberHexString: BigNumber.from(amountDenominatedInToken).toHexString(),
      };
      if (isPayment(p)) {
        const ttPartial2: Omit<TokenTransfer, 'token'> = Object.assign({}, ttPartial, {
          receiverAddress: p.receiverAddress,
          senderAddress: p.senderAddress,
        });
        // The following curious block of code is needed because until the type guard isToken is executed, TypeScript can't infer that `token` is assignable to TokenTransfer.token:
        if (isToken(token)) {
          const tt: TokenTransferForToken = Object.assign(ttPartial2, { token });
          return tt;
        } else {
          const tt: TokenTransferForNativeCurrency = Object.assign(ttPartial2, { token });
          return tt;
        }
        //  NB I asked GPT why the isToken type guard is needed to
        //  construct a TokenTransfer but isn't needed to construct a
        //  ProposedTokenTransfer, which is extremely weird given that
        //  ProposedTokenTransfer.token has an identical type to
        //  TokenTransfer.token. GPT gave this unsatisfying answer, "The
        //  issue is likely stemming from TypeScript's strictness
        //  regarding the type compatibility of discriminated unions when
        //  you try to assign the object to TokenTransfer, which is a
        //  union type.When you are constructing ProposedTokenTransfer,
        //  it's a single type, so TypeScript is less strict. For
        //  TokenTransfer, TypeScript has to make sure that the
        //  constructed object strictly adheres to one of the possible
        //  union types (TokenTransferForToken or
        //  TokenTransferForNativeCurrency), and the types must align
        //  exactly."
      } else {
        const tt: ProposedTokenTransfer = Object.assign({}, ttPartial, {
          receiver: p.receiver,
          token,
          ...(p.senderAddress && { senderAddress: p.senderAddress }),
        });
        return tt;
      }
    }
  }
}

type ChainIdPriority = {
  [chainId: number]: number;
};

type TokenTickerPriority = {
  [ticker: Uppercase<string>]: number;
};

// sortStrategiesByPriority sorts the passed (proposed) strategies from
// most preferable to least preferable. Usually, the concept of
// "preferable" is from the point of view of the sender since they are
// the counterparty spending the money. The passed (proposed) strategies
// are sorted in-place, and the array is returned for convenience.
function sortStrategiesByPriority(
  chainIdPriority: ChainIdPriority,
  tokenTickerPriority: TokenTickerPriority,
  strategies: ProposedStrategy[],
): ProposedStrategy[]
function sortStrategiesByPriority(
  chainIdPriority: ChainIdPriority,
  tokenTickerPriority: TokenTickerPriority,
  strategies: Strategy[],
): Strategy[]
function sortStrategiesByPriority(
  chainIdPriority: ChainIdPriority,
  tokenTickerPriority: TokenTickerPriority,
  strategies: Strategy[] | ProposedStrategy[],
): Strategy[] | ProposedStrategy[]
function sortStrategiesByPriority(
  chainIdPriority: ChainIdPriority,
  tokenTickerPriority: TokenTickerPriority,
  strategies: Strategy[] | ProposedStrategy[],
): Strategy[] | ProposedStrategy[] {
  return strategies.sort((a, b) => {
    const aLogicalAssetPriority = getStrategyLogicalAssetPriority(a);
    const bLogicalAssetPriority = getStrategyLogicalAssetPriority(b);
    if (aLogicalAssetPriority === bLogicalAssetPriority) {
      const aChainId = 'tokenTransfer' in a ? a.tokenTransfer.token.chainId : a.proposedTokenTransfer.token.chainId;
      const bChainId = 'tokenTransfer' in b ? b.tokenTransfer.token.chainId : b.proposedTokenTransfer.token.chainId;
      const aChainPriority = chainIdPriority[aChainId] ?? Number.NEGATIVE_INFINITY;
      const bChainPriority = chainIdPriority[bChainId] ?? Number.NEGATIVE_INFINITY;
      if (aChainPriority === bChainPriority) {
        const aTicker = 'tokenTransfer' in a ? a.tokenTransfer.token.ticker : a.proposedTokenTransfer.token.ticker;
        const bTicker = 'tokenTransfer' in b ? b.tokenTransfer.token.ticker : b.proposedTokenTransfer.token.ticker;
        const aTickerPriority = tokenTickerPriority[aTicker] ?? Number.NEGATIVE_INFINITY;
        const bTickerPriority = tokenTickerPriority[bTicker] ?? Number.NEGATIVE_INFINITY;
        return bTickerPriority - aTickerPriority;
      } else return bChainPriority - aChainPriority;
    } else return bLogicalAssetPriority - aLogicalAssetPriority;
  });
}

// getStrategyLogicalAssetPriority returns the strategy's logical asset
// priority suitable to be used as a comparator during strategy
// prioritization. Higher priorities are better. The strategy is able to
// compute its own logical asset priority internally, without other
// data, because strategies contain their payments and we define logical
// asset priority based on the match (or mismatch) between a strategy's
// payment mechanism's logical asset and its payment's logical asset.
function getStrategyLogicalAssetPriority(s: Strategy | ProposedStrategy): number {
  const highestPriority = Number.MAX_SAFE_INTEGER;
  const lowestPriority = Number.MIN_SAFE_INTEGER;
  const tokenTicker: Uppercase<string> = 'tokenTransfer' in s ? s.tokenTransfer.token.ticker : s.proposedTokenTransfer.token.ticker;
  const lat: LogicalAssetTicker | undefined = getLogicalAssetTickerForTokenOrNativeCurrencyTicker(tokenTicker);
  if (lat === undefined) return lowestPriority; // the passed Strategy/ProposedStrategy is not supported by any logical asset. This implies the strategy's payment mechanism uses some kind of exotic asset that is not supported by a logical asset, so we'll de-prioritize this strategy. Example: a strategy of paying UNI to settle a USD payment
  else {
    const logicalAssetTickers: PrimaryWithSecondaries<LogicalAssetTicker> = 'tokenTransfer' in s ? s.payment.logicalAssetTickers : s.proposedPayment.logicalAssetTickers;
    if (lat === logicalAssetTickers.primary) return highestPriority; // the passed Strategy/ProposedStrategy is supported by the same logical asset as its Payment. This means the strategy's payment mechanism is denominated in the same logical asset as its underlying payment, so this strategy is a direct (non-foreign-exchange) payment method for this payment, and so we'll give it highest priority as it's the most natural kind of strategy for this payment. Example: a strategy of paying USDC to settle a USD payment, or paying WETH to settle an ETH payment
    else {
      const secondaryIndex = logicalAssetTickers.secondaries.indexOf(lat);
      return secondaryIndex > -1 ? highestPriority - secondaryIndex - 1 : lowestPriority + 1; // the passed Strategy/ProposedStrategy may be supported by one of its Payment's secondary logical assets. If so, we'll assign it a higher priority if it appears earlier in the secondaries. Eg. two strategies supported by their payment's 1st secondary logical asset have the same logical asset priority, even though the actual logical assets may differ between the two strategies. We'll assign a lower priority if the strategy's logical asset doesn't appear in its payment's secondaries- which corresponds to a weird case where the strategy has a logical asset but for some reason it doesn't appear in its payment's primary or secondaries- but not as low as when the strategy lacks a logical asset.
    }
  }
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
  USDC: 1000, // I put USDC as top priority because I think ppl generally prefer to use it
  DAI: 900, // DAI is the most popular decentralized stablecoin so I made it 2nd highest priority
  LUSD: 800, // LUSD is the most decentralized stablecoin so I made it 3rd highest priority
  USDT: 700, // USDT is quite popular so I made it 4th highest priority

  // People generally want to pay with stablecoins, so non-stables have lower priority:
  ETH: 150, // ETH is prioritized above WETH because it's more natural (naturalness principle)
  WETH: 100,
  MATIC: 50,
};

if (isProduction) allTokenTickers.forEach(ticker => {
  if (staticTokenTickerPriority[ticker] === undefined) console.warn("token ticker not assigned a strategy priority", ticker);
});
