import { BigNumber } from "@ethersproject/bignumber";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CurrencyInput from "react-currency-input-field";
import { FaTimesCircle } from "react-icons/fa";
import { ExchangeRates, convert } from "./ExchangeRates";
import { RenderLogicalAssetAmount } from "./RenderLogicalAssetAmount";
import { LogicalAsset, LogicalAssetTicker, getDecimalsToRenderForLogicalAssetTicker, logicalAssetsByTicker, parseLogicalAssetAmount } from "./logicalAssets";
import { useExchangeRates } from "./useExchangeRates";

interface CurrencyAmountInputProps {
  logicalAssetTicker: LogicalAssetTicker;
  inputId: string;
  setAmount: (amount: number | undefined) => void;
}

// CurrencyAmountInput is the 3cities canonical currency amouunt input
// UX.
export const CurrencyAmountInput: React.FC<CurrencyAmountInputProps> = ({ logicalAssetTicker, inputId, setAmount }) => {
  const { amount, amountInputElement } = useCurrencyAmountInput(logicalAssetTicker, inputId);
  useEffect(() => {
    setAmount(amount);
  }, [setAmount, amount]);
  return amountInputElement;
}

const amountRawDefault = "0"; // Q: why set amountRawDefault to "0" instead of undefined? A: It's because when the amount input is reset by the user clicking the X, we execute the reset by setting amountRaw to its initial value, but if this initial value is undefined, then CurrencyInput doesn't actually get reset because CurrencyInput defines passing value=undefined to mean "disregard this passed value and maintain amount as internal state"
const amountInputWidthDefault = 1; // width to fit amountRawDefault

// useCurrencyAmountInput returns a currency amount input element
// denominated in the passed logical asset, as well as the amount the
// user has typed into this input element. This is the 3cities canonical
// currency amount input UX.
function useCurrencyAmountInput(logicalAssetTicker: LogicalAssetTicker, inputId: string): {
  amount: number | undefined;
  amountInputElement: JSX.Element;
} {
  const [amountInputWidth, setAmountInputWidth] = useState(amountInputWidthDefault);
  const amountInputContainerStyle = useMemo(() => {
    return { width: `${amountInputWidth}ch` };
  }, [amountInputWidth]);

  const amountInputDecimalsLimit = getDecimalsToRenderForLogicalAssetTicker(logicalAssetTicker); // specify the currency input to have as many decimals as we'd canonically render for a given currency. For example, two decimals for USD ($2.04) and four decimals for ETH (0.1256e)

  const [amountRaw, setAmountRaw] = useState<string | undefined>(amountRawDefault);
  const amount: number | undefined = useMemo(() => {
    if (amountRaw === undefined) return undefined;
    else try {
      const v = parseFloat(amountRaw);
      if (v > 0) return v;
      else return undefined;
    } catch (err) {
      console.warn(err);
      return undefined;
    }
  }, [amountRaw]);

  const recalculateWidthFromAmountInputTransformRawValue = useCallback((sRawInput: string) => {
    // CurrencyInput.transformRawValue is called on each keystroke, and we take advantage of that by using this callback to dynamically update the width of the CurrencyInput container so that its width always corresponds to the length of the current value, including decimal places and commas. The reason we have to do this is because if we don't explicitly set the width of CurrencyInput, its child <input> seems to default to a strange static max width. Other methods attempted here included styles like w-min, w-max, w-fit, min-width, and max-width, but none of those actually changed the default width of the input element. It seems to be necessary to explicitly set the width of the <input>. So, we do this by setting it to `w-full` and then dynamically varying the width of the parent container div. Note that our dynamic width implementation sets the width using an inline style instead of with tailing classes because tailwind styles are JIT-compiled so one can't dynamically generate custom tailwind styles at runtime (eg. you can't dynamically generate w-[8ch]).

    const sRaw: string = (() => { // here we transform sRawInput based on a static list of UX edge cases
      const droppedInvalidChars = sRawInput.replace(/[^\d.,]/g, ''); // sRawInput may contain up to one invalid chars (eg. if the person is mashing the keyboard). Valid chars are digits, decimals, and commas
      // @eslint-no-use-below[sRawInput] -- sRawInput was mapped to dropInvalidChars
      if (droppedInvalidChars.startsWith('.') && droppedInvalidChars.length === 2) return `0${droppedInvalidChars}`; // sRawInput can of the form ".<digit>" iff the user (repeatedly) hits backspace to fully clear the input and then initially types a period followed by a digit. If instead the user hits the "X" to clear the input amount or the input has initially loaded, then the amount is set to the default 0, and if the user then types a period, that period will be appended to the 0, resulting in an sRawInput value of "0.", which does not trigger the edge case here. But in this edge case of sRawInput being ".<digit>", CurrencyInput postprocess prepends a 0 and renders "0.<digit>", resulting in an incorrect render width because the width was calculated here using ".<digit>". So in this case we prepend the 0 before calculating render width
      else return droppedInvalidChars;
    })();

    // The weird idea here is that we need to calculate the true render width using the passed sRaw, noting that the true on-screen render width that we'll calculate may often be different than a naive sRaw.length sRaw because the (unmodified) sRaw returned by this function will then have its length modified via being postprocessed by CurrencyInput. For example, if the user clears the input and then types "05", the passed sRaw will be "05" but CurrencyInput postprocess will correctly render only "5" (without the preceding "0"), and our rules here need to calculate the true render width of 1 character for the "5". This gives us the strange rules below:
    const s = sRaw.replace(/,/g, ""); // for the purpose of calculating width, strip out any commas because they are provided inconsistently based on internal render status of CurrencyInput. We will count the expected commas in render manually.
    const containsADecimal = s.indexOf('.') > -1;
    const numberOfDigitsBeforeDecimal = s.indexOf('.') > -1 ? s.indexOf('.') : s.length; // NB there can be multiple decimal characters in the passed string due to CurrencyInput internal render state.
    const numberOfCommas = Math.floor(numberOfDigitsBeforeDecimal / 4);
    const numberOfDigitsAfterDecimal = Math.min(amountInputDecimalsLimit, countCharsAfterDecimal(s)); // NB there can be up to (amountInputDecimalsLimit+1) digits after the decimal due to CurrencyInput internal render state (but never +2), so here we cap the number of digits after decimal at amountInputDecimalsLimit.

    const width = (
      // +1 per digit before 1st decimal:
      numberOfDigitsBeforeDecimal
      // +1 per digit after decimal:
      + numberOfDigitsAfterDecimal
      // +0.5 if contains at least one decimal (0.5 because this isn't a fixed-width font and commas and decimals are narrower. We tried also 0.33 and 0.4 and found 0.5 to be most reliable to avoid width being too narrow on mobile):
      + (containsADecimal ? 1 : 0) * 0.5
      // +0.5 per each comma (0.5 because this isn't a fixed-width font and commas and decimals are narrower. We tried also 0.33 and 0.4 and found 0.5 to be most reliable to avoid width being too narrow on mobile):
      + numberOfCommas * 0.5
      // -1 if string doesn't have a decimal and begins with a 0 because when the element initially loads or resets, the user's first keystroke will result in the string eg. "04" (ie. this string never has a decimal which is why we use presence of a decimal to detect this case) which we want to interpret as "4":
      + (!containsADecimal && sRaw.startsWith('0') ? -1 : 0)
    );
    setAmountInputWidth(Math.max(amountInputWidthDefault, width)); // don't allow the calculated width to be less than the default width because then the input appears to collapse and it looks bad. (width can be less than 1 if sRaw is the empty string or ".")
    return sRaw; // NB we return the (unmodified) passed sRaw because we're only using this hook to calculate render width and not to actually transform the raw value.
  }, [amountInputDecimalsLimit, setAmountInputWidth]);

  useEffect(() => { // when currency changes, ensure that the currency input amount doesn't exceed the new currency's max decimals to render. This prevents eg. if the user types "0.1234 ETH" and then changes the currency to USD, we don't want to show "$0.1234" because the max render decimals for USD is 2 so we'll truncate to "$0.12". --> we also must force an input amount width recalculation, see note below.
    if (amountRaw) {
      const [whole, decimal] = amountRaw.split(".");
      if (decimal && decimal.length > amountInputDecimalsLimit) {
        const truncatedDecimal = decimal.substring(0, amountInputDecimalsLimit);
        const newAmountRaw = `${whole}.${truncatedDecimal}`;
        setAmountRaw(newAmountRaw);
        recalculateWidthFromAmountInputTransformRawValue(newAmountRaw); // here we must force an amount input width recalculation because if we don't, then the old width will persist, which means, if amountInputDecimalsLimit has decreased, the input will be too wide for the new truncated input. The details for why we must force the recalculation are: when amountInputDecimalsLimit changes, CurrencyInput accepts that props change, updates its internal state, and actually does call recalculateWidthFromAmountInputTransformRawValue, but this call occurs before this effect and thus uses the stale (non-truncated, if narowing decimals) raw value. So, we then re-recalculate width here.
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- here we don't want to rerun the effect if amountRaw changes, only if the currency changes (or other definitional/callback deps)
  }, [setAmountRaw, logicalAssetTicker, amountInputDecimalsLimit, recalculateWidthFromAmountInputTransformRawValue]);

  const er: ExchangeRates | undefined = useExchangeRates();

  const amountUsdEquivalent: bigint | undefined = useMemo(() => {
    return amount && er && logicalAssetTicker !== 'USD' ? convert({
      fromTicker: logicalAssetTicker,
      toTicker: 'USD',
      fromAmount: parseLogicalAssetAmount(amount.toString()).toBigInt(),
      er,
    }) : undefined;
  }, [logicalAssetTicker, amount, er]);

  const currencyInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { // when the user is typing the currency amount, we automatically blur the currency amount input if the user hits the enter key. On mobile, this has the convenient effect of enabling the user to close the number pad by hitting the enter key instead of having to tap outside the number pad.
    const handleKeyDown = (event: KeyboardEvent) => { // TODO right now, this handler fires if Enter is pressed any time the page is loaded. Can we apply the event handler only to currencyInputRef? Eg. can we check that the passed event's target is currencyInputRef?
      if (event.key === 'Enter' || event.keyCode === 13) currencyInputRef.current?.blur();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const amountInputElement = useMemo<JSX.Element>(() => {
    const la: LogicalAsset = logicalAssetsByTicker[logicalAssetTicker];
    return <div className="relative flex items-center justify-center">
      {amountUsdEquivalent ? <span className="absolute bottom-[-1.5em] w-fit text-lg text-gray-500"><RenderLogicalAssetAmount logicalAssetTicker={"USD"} amountAsBigNumberHexString={BigNumber.from(amountUsdEquivalent).toHexString()} /></span> : undefined}
      <label className={`flex-none text-6xl font-medium text-black ${la.symbol.prefix ? '' : 'invisible pl-6'}`} htmlFor={inputId}>{la.symbol.prefix}{la.symbol.suffix}</label>
      <div className="text-6xl font-bold" style={amountInputContainerStyle}>
        <CurrencyInput
          ref={currencyInputRef}
          autoFocus={false /* NB autofocus on mobile will only successfully pop up the number pad if a user action triggered the script --> eg. if user refreshes page on /pay-link, this won't pop up automatically, it's an anti-spam browser feature. But if the user switches routes eg. by clicking 'request money' then the pad will pop-up automatically on autofocous --> but here we unconditionally set autoFocus=false so that users can initially see the entire pay link widget without the spammy number pad popping up and disrupting that first impression. */}
          className={"rounded-md bg-inherit focus:outline-none w-full placeholder-black"}
          id={inputId}
          name="amount"
          placeholder="0"
          prefix=""
          autoComplete="off"
          allowNegativeValue={false}
          defaultValue={0}
          decimalsLimit={amountInputDecimalsLimit}
          value={amountRaw}
          transformRawValue={recalculateWidthFromAmountInputTransformRawValue}
          onValueChange={(vs) => setAmountRaw(vs)}
        />
      </div>
      <label className={`flex-none text-6xl font-medium text-black ${la.symbol.suffix ? '' : 'hidden'}`} htmlFor={inputId}>{la.symbol.prefix}{la.symbol.suffix}</label>
      <div className={`self-start p-1 ${la.symbol.suffix ? 'pr-0' : 'pr-3'} text-xl`} onClick={() => {
        setAmountRaw(amountRawDefault);
        setAmountInputWidth(amountInputWidthDefault); // here we must manually reset amountInputWidth as it's only automatically updated on CurrencyInput keystrokes or other CurrencyInput internal state changes
        const inputElement = document.getElementById(inputId);
        if (inputElement) inputElement.focus();
        else console.error(`Could not find element with id ${inputId} to focus after reseting amount to 0.`);
      }}>
        <FaTimesCircle className="text-gray-500" />
      </div>
    </div>;
  }, [logicalAssetTicker, inputId, amountInputContainerStyle, amountInputDecimalsLimit, amountRaw, recalculateWidthFromAmountInputTransformRawValue, amountUsdEquivalent]);

  const ret = useMemo((): ReturnType<typeof useCurrencyAmountInput> => {
    return {
      amount,
      amountInputElement,
    };
  }, [amount, amountInputElement]);

  return ret;
}

function countCharsAfterDecimal(s: string): number {
  const decimalIndex = s.indexOf('.');
  if (decimalIndex > -1) {
    return s.length - decimalIndex - 1;
  } else return 0;
}
