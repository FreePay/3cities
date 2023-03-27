import { useCallback, useEffect, useMemo, useState } from "react";
import { Strategy } from "./strategies";

// useBestStrategy filters and partitions the passed strategies into
// "best" and "others" and provides the client an API to disable a
// strategy from appearing as the best or in the others, useful eg. if
// it has been determined to be unviable for the user (eg. they can't
// afford the gas fee). useBestStrategy assumes the passed strategies
// are sorted in the order of "best" to "worst". The returned
// bestStrategy is equivalent to the passed strategies[i] for the min
// index i where that strategies[i] hasn't been disabled by the client
// calling disableStrategy(strategies[i]). useBestStrategy also
// provides the client an API to select a specific strategy to
// manually set as the best strategy. Note that disableStrategy takes
// precedence over selectStrategy, so if a client calls both
// selectStrategy(s) and disableStrategy(s), then s will be disabled
// and not set as the best strategy.
export function useBestStrategy(strategies: Strategy[] | undefined): {
  bestStrategy: Strategy | undefined;
  otherStrategies: Strategy[] | undefined;
  disableStrategy: (s: Strategy) => void;
  selectStrategy: (s: Strategy) => void;
} {
  const [disabledStrategies, setDisabledStrategies] = useState<Map<Strategy, true>>(new Map());
  const [disabledStrategiesNonce, setDisabledStrategiesNonce] = useState(0); // a nonce to trigger a rerender when we update the map valeus
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | undefined>(undefined);

  useEffect(() => {
    setDisabledStrategies(new Map());
    setSelectedStrategy(undefined)
  }, [strategies, setDisabledStrategies, setSelectedStrategy]);

  const disableStrategy = useCallback<(s: Strategy) => void>((s: Strategy) => {
    disabledStrategies.set(s, true);
    setDisabledStrategiesNonce(n => n + 1);
  }, [disabledStrategies, setDisabledStrategiesNonce]);

  const bestStrategy = useMemo<Strategy | undefined>(() => {
    if (strategies === undefined || disabledStrategiesNonce < 0) return undefined; // here we add the no-op "|| disabledStrategiesNonce < 0" to satisfy the react hook deps linter
    else if (selectedStrategy !== undefined && !disabledStrategies.has(selectedStrategy)) return selectedStrategy;
    else return strategies.find(s => !disabledStrategies.has(s));
  }, [strategies, disabledStrategies, disabledStrategiesNonce, selectedStrategy]);

  const otherStrategies = useMemo<Strategy[] | undefined>(() => {
    if (strategies === undefined || disabledStrategiesNonce < 0) return undefined; // here we add the no-op "|| disabledStrategiesNonce < 0" to satisfy the react hook deps linter
    else return strategies.filter(s => s !== bestStrategy && !disabledStrategies.has(s));
  }, [strategies, disabledStrategies, disabledStrategiesNonce, bestStrategy]);

  const selectStrategy = useCallback<(s: Strategy) => void>((s: Strategy) => {
    setSelectedStrategy(s);
  }, [setSelectedStrategy]);

  const ret = useMemo<ReturnType<typeof useBestStrategy>>(() => {
    return {
      bestStrategy,
      otherStrategies,
      disableStrategy,
      selectStrategy,
    };
  }, [bestStrategy, otherStrategies, disableStrategy, selectStrategy]);
  return ret;
}
