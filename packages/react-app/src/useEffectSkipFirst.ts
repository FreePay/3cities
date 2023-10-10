import { DependencyList, EffectCallback, useEffect, useRef } from "react";

// useEffectSkipFirst is a wrapper around useEffect that skips the first
// invocation of the useEffect callback. This is useful to eg. run an
// effect only when props change, and not when mounting the component.
// WARNING as of React 18, when you use Strict Mode in a non-production
// build, React renders each component twice to help you find unexpected
// side effects and this means useEffectSkipFirst WILL ALWAYS RUN THE
// PASSED EFFECT AT LEAST ONCE IN A NON-PRODUCTION BUILD because
// isFirstRun.current === false during React's automatic second render.
export function useEffectSkipFirst(effect: EffectCallback, deps?: DependencyList): void {
  const isFirstRun = useRef(true); // NB here we might be tempted to use state instead, like `const [isFirstRun, setIsFirstRun] = useState(false)` however if we do this, setIsFirstRun(), like all state updates, will trigger a component rerender, which would be an unnecessary rerender. Instead we use a mutable ref and updating it doesn't trigger a rerender
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    } else {
      return effect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
