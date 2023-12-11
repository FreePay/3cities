import { useCallback, useMemo, useState } from "react";
import { useImmer } from "use-immer";
import { Strategy } from "./strategies";
import { getTokenKey } from "./tokens";

const emptySet = new Set<number>(); // WARNING useImmer may use object identity for render stability and so we pass a static object as the default value to avoid rerenders

// useBestStrategy filters and partitions the passed strategies into
// "best" and "others" and provides the client an API to affect these
// preferences. useBestStrategy assumes the passed strategies are sorted
// in the order of "best" to "worst".
export function useBestStrategy(strategies: Strategy[] | undefined): {
  bestStrategy: Strategy | undefined; // the best strategy among the passed strategies. Eg. this is the strategy most suitable to plug into a 1-Click Pay Now button. If selectStrategy hasn't been called by the client, then bestStrategy is equivalent to the passed strategies[i] for the min index i where that strategies[i] hasn't been disabled by the client. NB disabling a strategy takes precedence over selecting a strategy, so if a strategy is selected but disabled, it will be disabled
  otherStrategies: Strategy[] | undefined; // all strategies in the order they were passed, excluding bestStrategy and disabled strategies
  disableAllStrategiesOriginatingFromChainId: (chainId: number) => void; // disable all strategies originating from the passed chainId
  resetDisabledStrategiesOriginatingFromChainId: () => void; // reset disabled strategies
  selectStrategy: (s: Strategy) => void; // select the passed strategy as the best strategy. The strategy's shape (currently TokenKey) will be stored internally, not the strategy itself, so if the passed strategies are regenerated and old strategies destroyed, useBestStrategy will attempt to find the same best strategy among the new strategies. For example, this stabilizes the selected strategy as exchange rates are regenerated
} {
  const [disabledChainIds, setDisabledChainIds] = useImmer<Set<number>>(emptySet); // strategies matching these chainIds will be disabled via excluding them from bestStrategy and otherStrategies

  const [selectedStrategyKey, setSelectedStrategyKey] = useState<string | undefined>(undefined); // the selected strategy key is a string that uniquely identifies the shape of the client's selected strategy, allowing the selected strategy to be automatically reselected when strategies are regenerated. Example: user selects a strategy of paying ETH on zkSync, and then strategies regenerate so the selected Strategy is destroyed, and so the selectedStrategyKey will help find any new Strategy of paying ETH on zkSync, and this stabilizes the end-user UX so that their selected strategy doesn't change as strategies regenerate

  const doesStrategyMatchSelectedStrategyKey = useCallback<(s: Strategy) => boolean>((s: Strategy) => {
    // WARNING this predicate and the selectedStrategyKey definition must be updated as we add new strategy types. For example, if the user selects an auto-bridging strategy, the selectedStrategyKey can't simply be the strategy's tokenKey as the tokenKey is for one token on one chain but an auto-bridging strategy is cross-chain and isn't uniquely identified by a single tokenKey
    return getTokenKey(s.tokenTransfer.token) === selectedStrategyKey;
  }, [selectedStrategyKey]);

  const bestStrategy = useMemo<Strategy | undefined>(() => {
    if (strategies === undefined) return undefined;
    else {
      const bestStrategyFromSelectedStrategyKey: Strategy | undefined = strategies.find((s) => doesStrategyMatchSelectedStrategyKey(s) && !disabledChainIds.has(s.tokenTransfer.token.chainId)); // in our API, disabling a strategy takes precedence over selecting one, and here we respect that
      if (bestStrategyFromSelectedStrategyKey) return bestStrategyFromSelectedStrategyKey;
      else return strategies.find((s) => !disabledChainIds.has(s.tokenTransfer.token.chainId));
    }
  }, [strategies, disabledChainIds, doesStrategyMatchSelectedStrategyKey]);

  const otherStrategies = useMemo<Strategy[] | undefined>(() => {
    if (strategies === undefined) return undefined;
    else return strategies.filter(s => s !== bestStrategy && !disabledChainIds.has(s.tokenTransfer.token.chainId));
  }, [strategies, disabledChainIds, bestStrategy]);

  const disableAllStrategiesOriginatingFromChainId = useCallback<(chainId: number) => void>((chainId: number) => {
    setDisabledChainIds((draft) => draft.add(chainId));
  }, [setDisabledChainIds]);

  const resetDisabledStrategiesOriginatingFromChainId = useCallback<() => void>(() => {
    setDisabledChainIds((draft) => draft.clear());
  }, [setDisabledChainIds]);

  const selectStrategy = useCallback<(s: Strategy) => void>((s: Strategy) => setSelectedStrategyKey(getTokenKey(s.tokenTransfer.token)), [setSelectedStrategyKey]); // WARNING see note in doesStrategyMatchSelectedStrategyKey on how the definition of selectedStrategyKey must be updated as we add new strategy types

  const ret = useMemo<ReturnType<typeof useBestStrategy>>(() => {
    return {
      bestStrategy,
      otherStrategies,
      disableAllStrategiesOriginatingFromChainId,
      resetDisabledStrategiesOriginatingFromChainId,
      selectStrategy,
    };
  }, [bestStrategy, otherStrategies, disableAllStrategiesOriginatingFromChainId, resetDisabledStrategiesOriginatingFromChainId, selectStrategy]);

  return ret;
}
