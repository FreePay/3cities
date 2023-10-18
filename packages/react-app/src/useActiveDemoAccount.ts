import { useContext } from "react";
import { ActiveDemoAccountContext } from "./ActiveDemoAccountContext";

// useActiveDemoAccount returns the active global demo account or
// undefined if no demo account is active.
export function useActiveDemoAccount(): string | undefined {
  return useContext(ActiveDemoAccountContext);
}
