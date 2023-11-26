import { useContext } from "react";
import { ActiveDemoAccountContext } from "./ActiveDemoAccountContext";
import { Observer, useObservedValue } from "./observer";

// useActiveDemoAccount returns the active global demo account or
// undefined if no demo account is active.
export function useActiveDemoAccount(): string | undefined {
  const o: Observer<string | undefined> = useContext(ActiveDemoAccountContext);
  return useObservedValue(o);
}
