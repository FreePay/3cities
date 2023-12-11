import React, { useMemo, useState } from "react";
import { LogicalAssetTicker, logicalAssetsByTicker } from "./logicalAssets";

// TODO consider converting useLogicalAssetTickerSelectionInput into the
// LogicalAssetTickerSelectionInput component so that clients aren't
// forced to rerender on any state update internal to
// useLogicalAssetTickerSelectionInput.

// useLogicalAssetTickerSelectionInput returns a logical asset selection
// input element, as well as the active logical asset ticker currently
// selected by this input element. This is the 3cities canonical logical
// asset selection UX.
export function useLogicalAssetTickerSelectionInput(defaultLogicalAssetTicker: LogicalAssetTicker): {
  logicalAssetTicker: LogicalAssetTicker;
  logicalAssetTickerSelectionInputElement: JSX.Element;
} {
  const [logicalAssetTicker, setLogicalAssetTicker] = useState<LogicalAssetTicker>(defaultLogicalAssetTicker);

  const logicalAssetTickerSelectionInputElement = useMemo((): JSX.Element => {
    return <div className="grow flex justify-between gap-4">
      {(['USD', 'ETH', 'EUR'] satisfies LogicalAssetTicker[]).map((t: LogicalAssetTicker) => logicalAssetsByTicker[t]).map(la => <button
        key={la.ticker}
        type="button"
        disabled={la.ticker === logicalAssetTicker}
        className="focus:outline-none rounded-md px-2 py-1 font-medium border border-primary enabled:active:scale-95 enabled:bg-white enabled:text-primary sm:enabled:hover:bg-primary sm:enabled:hover:text-white disabled:bg-primary disabled:text-white disabled:cursor-not-allowed"
        onClick={() => setLogicalAssetTicker(la.ticker)}
      >
        {la.shortDescription}
      </button>)}
    </div>;
  }, [logicalAssetTicker, setLogicalAssetTicker]);

  const ret = useMemo((): ReturnType<typeof useLogicalAssetTickerSelectionInput> => {
    return {
      logicalAssetTicker,
      logicalAssetTickerSelectionInputElement,
    };
  }, [logicalAssetTicker, logicalAssetTickerSelectionInputElement]);

  return ret;
}
