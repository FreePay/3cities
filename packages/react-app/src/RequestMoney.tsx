import { isAddress } from "@ethersproject/address";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CurrencyInput from "react-currency-input-field";
import { FaCheckCircle, FaExclamationCircle, FaShareAlt, FaTimesCircle } from "react-icons/fa";
import useClipboard from "react-use-clipboard";
import { useImmer } from "use-immer";
import { useAccount, useDisconnect } from "wagmi";
import { ConnectWalletButtonCustom } from "./ConnectWalletButton";
import Modal from "./Modal";
import { Narrow } from "./Narrow";
import QRCode from "./QRCode";
import { renderLogicalAssetAmount } from "./RenderLogicalAssetAmount";
import { Spinner } from "./Spinner";
import { StrategyPreferences } from "./StrategyPreferences";
import { ToggleSwitch } from "./ToggleSwitch";
import { ReceiverProposedPayment } from "./agreements";
import { allSupportedChainIds, getSupportedChainName } from "./chains";
import { Checkout } from "./checkout";
import { isProduction } from "./isProduction";
import { LogicalAssetTicker, getDecimalsToRenderForLogicalAssetTicker, logicalAssetsByTicker, parseLogicalAssetAmount } from "./logicalAssets";
import { isTokenTickerSupportedByLogicalAsset } from "./logicalAssetsToTokens";
import { serializeToModifiedBase64 } from "./serialize";
import { allTokenTickers } from "./tokens";
import { truncateEthAddress } from "./truncateAddress";
import useDebounce from "./useDebounce";
import { useEnsAddress } from "./useEnsAddress";
import { useEnsName } from "./useEnsName";

// TODO convert manual <input>s into useInput --> I started trying to do this for the recipient input, but encountered a challenge and abandoned the effort. The problem is that there's a use-before-declare circular dependency rawRecipient->computedRecipient/addressForDebouncedRawRecipientEnsName->rawRecipientInputParams->circular. In the current impl with an inline <input>, this circular dependency is resolved by adding a layer of indirection where the input's inline onChange sets the rawRecipient, so rawRecipient can be defined above the input. But with the useInput hook, the hook returns the actual current value (as opposed to setting it indirectly in a callback), so in order to use the useInput hooks, a bit more work is needed, and/or perhaps a modification to useInput API. Here was my work in progress:
// const rawRecipientInputParams = useMemo(() => {
//   return {
//     className: `w-full rounded-md border px-3.5 py-2 leading-6 ${computedRecipient && !addressForDebouncedRawRecipientEnsName ? 'text-xs' : ''}`,
//     id: "rawRecipient",
//     type: "text",
//     placeholder: "Ethereum address or ENS",
//   };
// }, [computedRecipient, addressForDebouncedRawRecipientEnsName]);
// const [rawRecipientNew, rawRecipientInput, setRawRecipientNew] = useInput('', rawRecipientInputParams, { onEnterKeyPress: (e) => e.currentTarget.blur() });

const amountInputId = "amount-input";
const amountRawDefault = "0"; // Q: why set amountRawDefault to "0" instead of undefined? A: It's because when the amount input is reset by the user clicking the X, we execute the reset by setting amountRaw to its initial value, but if this initial value is undefined, then CurrencyInput doesn't actually get reset because CurrencyInput defines passing value=undefined to mean "disregard this passed value and maintain amount as internal state"
const amountInputWidthDefault = 1; // width to fit amountRawDefault

export const RequestMoney: React.FC = () => {
  const [logicalAssetTicker, setLogicalAssetTicker] = useState<LogicalAssetTicker>('USD');
  const logicalAsset = logicalAssetsByTicker[logicalAssetTicker];

  const [amountInputWidth, setAmountInputWidth] = useState(amountInputWidthDefault);
  const amountInputDecimalsLimit = getDecimalsToRenderForLogicalAssetTicker(logicalAssetTicker); // specify the currency input to have as many decimals as we'd canonically render for a given currency. For example, two decimals for USD ($2.04) and four decimals for ETH (0.1256e)
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [amountRaw, setAmountRaw] = useState<string | undefined>(amountRawDefault);
  useEffect(() => {
    if (amountRaw === undefined) setAmount(undefined)
    else try {
      const v = parseFloat(amountRaw);
      if (v > 0) setAmount(v);
      else setAmount(undefined);
    } catch (err) {
      console.warn(err);
    }
  }, [setAmount, amountRaw]);
  // @eslint-no-use-below[setAmount] amount is defined as the float parse of amountRaw and setAmount should be called nowhere else other than when amountRaw changes above

  const recalculateWidthFromAmountInputTransformRawValue = useCallback((sRaw: string) => {
    // CurrencyInput.transformRawValue is called on each keystroke, and we take advantage of that by using this callback to dynamically update the width of the CurrencyInput container so that its width always corresponds to the length of the current value, including decimal places and commas. The reason we have to do this is because if we don't explicitly set the width of CurrencyInput, its child <input> seems to default to a strange static max width. Other methods attempted here included styles like w-min, w-max, w-fit, min-width, and max-width, but none of those actually changed the default width of the input element. It seems to be necessary to explicitly set the width of the <input>. So, we do this by setting it to `w-full` and then dynamically varying the width of the parent container div. Note that our dynamic width implementation sets the width using an inline style instead of with tailing classes because tailwind styles are JIT-compiled so one can't dynamically generate custom tailwind styles at runtime (eg. you can't dynamically generate w-[8ch]).

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

  const [note, setNote] = useState<string>('');

  const [rawRecipient, setRawRecipient] = useState<string>('');
  const flushDebounce = rawRecipient.length < 1 || isAddress(rawRecipient); // if rawAddress is empty or a valid address, then we'll flush (ie. skip over) the debounce, which makes the UI a bit snappier when pasting or deleting an address
  const debouncedRawRecipient = useDebounce(rawRecipient, 500, flushDebounce);

  const { address: addressForDebouncedRawRecipientEnsName, isLoading: addressForDebouncedRawRecipientEnsNameIsLoading } = useEnsAddress(debouncedRawRecipient); // the resolved ethereum address for the ENS name which the user typed into the recipient input. NB here we do nothing with the returned error which is fine because instead, below, we show a visual warning if a non-empty debouncedRawRecipient results in an empty computedRecipient (for which one possible but not the only root cause is an error here)

  const clearRawRecipient = useCallback(() => setRawRecipient(''), [setRawRecipient]);

  const { address: connectedWalletAddress, isConnected } = useAccount({ onConnect: clearRawRecipient }); // here we must clear rawRecipient when wallet connects to avoid an inconsistent state where the value of rawRecipient is stale (something previously typed) prior to wallet being connected
  const connectedWalletAddressRendered: string | undefined = connectedWalletAddress ? truncateEthAddress(connectedWalletAddress, "••") : undefined; // NB we eagerly calculate connectedWalletAddressRendered to use it as the default value of computedRecipientRendered. If we didn't do this and instead defaulted computedRecipientRendered to undefined, and if the user's wallet is already connected on component mount, the first render from shows "Receive money at <nothing>" until the useEffect runs to set it. A long-term solution may be to migrate to a modern state management library like jotai that provides atomic renders for derived state, which offers benefits of (i) preventing renders from occuring before initial derived state is rendered and (ii) eliminating redundant rerenders from multiple useEffects calculate derived states (ie. jotai calculates any amount of derived state atomically before the next render).

  const [computedRecipient, setComputedRecipient] = useState<string | undefined>(undefined); // the ethereum address to which the requested money will be sent
  const [computedRecipientRendered, setComputedRecipientRendered] = useState<string | undefined>(connectedWalletAddressRendered); // the rendering of the ethereum address to which the money will be sent, suitable to display to the user

  const { ensName: ensNameForConnectedWalletAddress } = useEnsName(connectedWalletAddress);

  useEffect(() => { // a small state machine to determine and set the computed recipient based on the different ways it can be provided
    if (connectedWalletAddress && isConnected && isAddress(connectedWalletAddress)) { // here we sanity check that the connected address is actually a valid ethereum address. If it wasn't for any reason, the payment link would fail at pay time for the payor
      setComputedRecipient(connectedWalletAddress);
      setComputedRecipientRendered(ensNameForConnectedWalletAddress || connectedWalletAddressRendered);
    } else if (addressForDebouncedRawRecipientEnsName && isAddress(addressForDebouncedRawRecipientEnsName)) { // here we sanity check that the returned addressForEnsName is actually a valid ethereum address. If it wasn't for any reason, the payment link would fail at pay time for the payor
      setComputedRecipient(addressForDebouncedRawRecipientEnsName);
      setComputedRecipientRendered(debouncedRawRecipient); // here, debouncedRawRecipient is known to be an ENS name because its forward resolution to an address succeeded
    } else if (isAddress(debouncedRawRecipient)) {
      setComputedRecipient(debouncedRawRecipient);
      setComputedRecipientRendered(truncateEthAddress(debouncedRawRecipient, "••"));
    } else {
      setComputedRecipient(undefined);
      setComputedRecipientRendered(undefined);
    }
  }, [debouncedRawRecipient, addressForDebouncedRawRecipientEnsName, setComputedRecipient, setComputedRecipientRendered, connectedWalletAddress, isConnected, ensNameForConnectedWalletAddress, connectedWalletAddressRendered]);

  const [strategyPreferences, setStrategyPreferences] = useImmer<StrategyPreferences | undefined>(undefined);

  // TODO consider deleting strategyPreferences.acceptedTokenTickers when logicalAsset changes. Currently, this is disabled because it's a polish feature and would be incorrect if we add forex payments (eg. pay ETH to settle USD payment). Here is code to do this:
  // useEffect(() => { // delete token strategy preferences when the logical asset changes because the old token preferences aren't relevant to the new logical asset because we currently support settling a payment only with tokens supported by the payment's logical asset (eg. you can't currently pay an ETH token to settle a USD payment), so each logical asset's supported tokens are disjoint
  //   setStrategyPreferences(draft => {
  //     if (draft) delete draft['acceptedTokenTickers'];
  //   });
  // }, [setStrategyPreferences, logicalAssetTicker])

  const toggleTokenTickerForStrategyPreferences = (tt: string) => {
    setStrategyPreferences(draft => {
      if (draft === undefined) {
        console.error("toggleTokenTickerForStrategyPreferences: strategyPreferences unexpectedly undefined");
      } else if (draft.tokenTickerExclusions === undefined) draft.tokenTickerExclusions = [tt];
      else {
        const i = draft.tokenTickerExclusions.indexOf(tt);
        if (i > -1) draft.tokenTickerExclusions.splice(i, 1);
        else draft.tokenTickerExclusions.push(tt);
      }
    });
  }

  const toggleChainIdForStrategyPreferences = (cid: number) => {
    setStrategyPreferences(draft => {
      if (draft === undefined) {
        console.error("toggleChainIdForStrategyPreferences: strategyPreferences unexpectedly undefined");
      } else if (draft.chainIdExclusions === undefined) draft.chainIdExclusions = [cid];
      else {
        const i = draft.chainIdExclusions.indexOf(cid);
        if (i > -1) draft.chainIdExclusions.splice(i, 1);
        else draft.chainIdExclusions.push(cid);
      }
    });
  }

  const toggleUseOfStrategyPreferences = useCallback((isOnAndNotUsingStrategyPrefs: boolean) => {
    if (isOnAndNotUsingStrategyPrefs) setStrategyPreferences(undefined);
    else setStrategyPreferences({});
  }, [setStrategyPreferences]);

  const [checkout, setCheckout] = useState<Narrow<Checkout, 'proposedAgreement', ReceiverProposedPayment> | undefined>(undefined); // TODO support Checkouts with more types than only ReceiverProposedPayment.
  useEffect(() => {
    if (amount && amount > 0 && computedRecipient) {
      setCheckout({
        proposedAgreement: { // TODO perhaps this ReceiverProposedPayment literal should be constructed in a centralized function to ensure that it's done correctly and consistently everywhere (but I think these literals are built nowhere else right now)
          logicalAssetTicker,
          amountAsBigNumberHexString: parseLogicalAssetAmount(amount.toString()).toHexString(),
          toAddress: computedRecipient,
          ...(note && { note: note.trim() }),
          p: false,
          rpp: true,
        },
        strategyPreferences: strategyPreferences || {},
      });
    } else setCheckout(undefined);
  }, [setCheckout, logicalAssetTicker, amount, computedRecipient, note, strategyPreferences]);

  const [checkoutLink, setCheckoutLink] = useState<string | undefined>(undefined);
  useEffect(() => {
    setCheckoutLink(checkout && `${process.env['REACT_APP_DEVELOPMENT_INTRANET_IP'] ? ('http://' + process.env['REACT_APP_DEVELOPMENT_INTRANET_IP'] + ':' + location.port) : location.origin}/#/pay?c=${serializeToModifiedBase64(checkout)}`); // REACT_APP_DEVELOPMENT_INTRANET_IP is a development feature. Set it in .env.local so that payment links generated on your laptop can be opened on your phone using the LAN
  }, [setCheckoutLink, checkout]);

  const amountInputContainerStyle = useMemo(() => {
    return { width: `${amountInputWidth}ch` };
  }, [amountInputWidth]);

  const [showModalNonce, setShowModalNonce] = useState(0);
  const incrementShowModalNonce = useCallback(() => setShowModalNonce(n => n + 1), [setShowModalNonce]);
  useEffect(() => {
    setShowModalNonce(0); // NB we must reset showModalNonce when checkout changes, otherwise the modal will pop up without the user clicking request once checkout is redefined.
  }, [setShowModalNonce, checkout]);

  const checkoutTextToShare: string = (() => {
    if (checkout) return `Hey, can you please pay me ${renderLogicalAssetAmount({ ...checkout.proposedAgreement, showAllZeroesAfterDecimal: true })} using this link`;
    else return ' ';
  })();

  const checkoutLinkWithTextToShare: string = (() => {
    if (checkoutLink) return `${checkoutTextToShare} ${checkoutLink}`;
    else return ' ';
  })();

  const [isCheckoutLinkCopied, setIsCheckoutLinkCopied] = useClipboard(checkoutLinkWithTextToShare, {
    successDuration: 10000, // `isCopied` will go back to `false` after 10000ms
  });

  const { disconnect } = useDisconnect();

  const currencyInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { // when the user is typing the currency amount, we automatically blur the currency amount input if the user hits the enter key. On mobile, this has the convenient effect of enabling the user to close the number pad by hitting the enter key instead of having to tap outside the number pad.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.keyCode === 13) currencyInputRef.current?.blur();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [showAmountRequiredWarning, setShowAmountRequiredWarning] = useState(false); // if the user clicks Send Pay Link before filling in an amount, we'll show a warning that amount is a required field
  const [showRecipientRequiredWarning, setShowRecipientRequiredWarning] = useState(false); // if the user clicks Send Pay Link before filling in a recipient, we'll show a warning that recipient is a required field

  const onClickSendPayLink = useCallback(() => {
    if (checkout) {
      setShowAmountRequiredWarning(false);
      setShowRecipientRequiredWarning(false);
      incrementShowModalNonce();
    } else {
      // NB here we set each warning flag to true if its required data are missing, but we never set them to false here because, as a UX design decision, we never clear warnings until the checkout link has been successfully generated (at which point we clear all warning flags, ie. in the if branch of this conditional)
      if (!(amount && amount > 0)) setShowAmountRequiredWarning(true);
      if (!computedRecipient) setShowRecipientRequiredWarning(true);
    }
  }, [incrementShowModalNonce, setShowAmountRequiredWarning, setShowRecipientRequiredWarning, amount, checkout, computedRecipient]);

  return <div className="mt-[6vh] w-full max-w-sm mx-auto flex flex-col items-center justify-center">
    <div className="w-full flex justify-start items-center gap-1">
      <span>Amount</span>
      {showAmountRequiredWarning && <span className="text-red-600">(required)</span>}
    </div>
    {/* TODO extract this into a useCurrencyAmountInput hook similar to useInput (also see "convert manual <input>s into useInput" note at top of this file): */}
    <div className="flex items-center justify-center">
      <label className={`flex-none text-6xl font-medium text-black ${logicalAsset.symbol.prefix ? '' : 'invisible pl-6'}`} htmlFor={amountInputId}>{logicalAsset.symbol.prefix}{logicalAsset.symbol.suffix}</label>
      <div className="text-6xl font-bold" style={amountInputContainerStyle}>
        <CurrencyInput
          ref={currencyInputRef}
          autoFocus={false /* NB autofocus on mobile will only successfully pop up the number pad if a user action triggered the script --> eg. if user refreshes page on /pay-link, this won't pop up automatically, it's an anti-spam browser feature. But if the user switches routes eg. by clicking 'request money' then the pad will pop-up automatically on autofocous --> but here we unconditionally set autoFocus=false so that users can initially see the entire pay link widget without the spammy number pad popping up and disrupting that first impression. */}
          className={"rounded-md bg-inherit focus:outline-none w-full placeholder-black"}
          id={amountInputId}
          name="amount"
          placeholder="0"
          prefix=""
          allowNegativeValue={false}
          defaultValue={0}
          decimalsLimit={amountInputDecimalsLimit}
          value={amountRaw}
          transformRawValue={recalculateWidthFromAmountInputTransformRawValue}
          onValueChange={(vs) => setAmountRaw(vs)}
        />
      </div>
      <label className={`flex-none text-6xl font-medium text-black ${logicalAsset.symbol.suffix ? '' : 'hidden'}`} htmlFor={amountInputId}>{logicalAsset.symbol.prefix}{logicalAsset.symbol.suffix}</label>
      <div className={`self-start p-1 ${logicalAsset.symbol.suffix ? 'pr-0' : 'pr-3'} text-xl`} onClick={() => {
        setAmountRaw(amountRawDefault);
        setAmountInputWidth(amountInputWidthDefault); // here we must manually reset amountInputWidth as it's only automatically updated on CurrencyInput keystrokes or other CurrencyInput internal state changes
        const inputElement = document.getElementById(amountInputId);
        if (inputElement) inputElement.focus();
        else console.error(`Could not find element with id ${amountInputId} to focus after reseting amount to 0.`);
      }}>
        <FaTimesCircle className="text-gray-500" />
      </div>
    </div>
    <div className="w-full flex flex-wrap justify-between items-center gap-2 mt-4">
      <span className="w-full">Currency</span>
      <div className="grow flex justify-between gap-4">
        {(['USD', 'ETH', 'EUR'] satisfies LogicalAssetTicker[]).map((t: LogicalAssetTicker) => logicalAssetsByTicker[t]).map(la => <button
          key={la.ticker}
          type="button"
          disabled={la.ticker === logicalAssetTicker}
          className="focus:outline-none rounded-md px-2 py-1 font-medium border border-primary enabled:active:scale-95 enabled:bg-white enabled:text-primary sm:enabled:hover:bg-primary sm:enabled:hover:text-white disabled:bg-primary disabled:text-white disabled:cursor-not-allowed"
          onClick={() => setLogicalAssetTicker(la.ticker)}
        >
          {la.shortDescription}
        </button>)}
      </div>
    </div>
    <div className="w-full flex justify-start items-center gap-1 mt-4">
      <span>Receive at</span>
      {showRecipientRequiredWarning && <span className="text-red-600">(required)</span>}
    </div>
    {connectedWalletAddress && isConnected && <div className="w-full flex flex-wrap justify-between items-center gap-2 mt-2">
      <span className="w-full break-words">{computedRecipientRendered}</span>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-xs font-medium focus:outline-none bg-primary sm:enabled:hover:bg-primary-darker  enabled:active:scale-95 text-white"
        onClick={() => disconnect()}
      >
        Disconnect to change
      </button>
    </div>}
    {!(connectedWalletAddress && isConnected) && <div className="flex flex-col justify-center items-starts w-full gap-2 mt-2">
      <div className="flex justify-start items-center w-full">
        <div className="w-full relative">
          <input
            className={`w-full rounded-md border px-3.5 py-2 leading-6 ${computedRecipient && !addressForDebouncedRawRecipientEnsName ? 'text-xs' : ''}`}
            id="rawRecipient"
            type="text"
            placeholder="Ethereum address or ENS"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.keyCode === 13) e.currentTarget.blur();
            }}
            onChange={(e) => setRawRecipient(e.target.value)}
            value={rawRecipient}
            spellCheck={false}>
          </input>
          <div className={`absolute top-1/2 transform -translate-y-1/2 right-1 flex justify-right items-center ${computedRecipient ? '' : 'hidden'}`}>
            {addressForDebouncedRawRecipientEnsName && <span className="text-gray-600">{truncateEthAddress(computedRecipient, "••")}</span>}
            <div className="z-10 bg-white px-2"><FaCheckCircle className="text-primary" /></div>
          </div>
          <div className={`absolute top-1/2 transform -translate-y-1/2 right-1 text-red-500 ${debouncedRawRecipient.length > 0 && !computedRecipient && !addressForDebouncedRawRecipientEnsNameIsLoading ? '' : 'hidden'}`}>
            <div className="z-10 bg-white px-2"><FaExclamationCircle className="text-red-500" /></div>
          </div>
          <div className={`absolute top-1/2 transform -translate-y-1/2 right-1 text-red-500 ${debouncedRawRecipient.length > 0 && !computedRecipient && addressForDebouncedRawRecipientEnsNameIsLoading ? '' : 'hidden'}`}>
            <div className="z-10 bg-white px-2"><Spinner
              containerClassName="absolute top-1/2 transform -translate-y-1/2 right-2 z-10 h-4 w-4 flex items-center justify-center"
              spinnerClassName='text-primary'
            /></div>
          </div>
        </div>
      </div>
      <div className="flex justify-start items-center gap-2">
        <ConnectWalletButtonCustom
          disconnectedLabel="Use Wallet (optional)"
          className="flex-none rounded-md px-3 py-1 text-xs font-medium focus:outline-none bg-primary sm:enabled:hover:bg-primary-darker  enabled:active:scale-95 text-white"
          disabledClassName="text-gray-200 pointer-events-none"
          loadingSpinnerClassName="text-gray-200 fill-primary"
        />
      </div>
    </div>}
    <div className="w-full flex flex-wrap justify-start items-center gap-2 mt-4">
      <span className="w-full">Note</span>
      <input
        className="w-full rounded-md border px-3.5 py-2"
        id="note"
        type="text"
        placeholder="What's this for? (optional)"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.keyCode === 13) e.currentTarget.blur();
        }}
        onChange={(e) => setNote(e.target.value)}
        value={note}
        spellCheck={false}>
      </input>
    </div>
    {/* TODO extract the strategy preferences editor into its own component. For example, it could be reused to set a user's default strategy preferences in the "Me" page. NB see all the ideas/todos in StrategyPreferences.ts */}
    <div className="mt-4 w-full flex justify-between items-center gap-4">
      <span className="grow">Default tokens and chains (recommended)</span>
      <ToggleSwitch initialIsOn={strategyPreferences === undefined} onToggle={toggleUseOfStrategyPreferences} offClassName="text-gray-500" className="font-bold text-3xl" />
    </div>
    {strategyPreferences !== undefined && <div className="flex flex-wrap w-full mt-2 gap-x-2 gap-y-1">
      {allTokenTickers.filter(isTokenTickerSupportedByLogicalAsset.bind(null, logicalAssetTicker)).map(tt => <div key={tt}>
        <ToggleSwitch
          offLabel={tt}
          className="gap-0.5"
          initialIsOn={strategyPreferences.tokenTickerExclusions === undefined || strategyPreferences.tokenTickerExclusions.indexOf(tt) < 0}
          onToggle={toggleTokenTickerForStrategyPreferences.bind(null, tt)}
        />
      </div>)}
      {allSupportedChainIds.map(cid => <div key={cid}>
        <ToggleSwitch
          offLabel={getSupportedChainName(cid)}
          className="gap-0.5"
          initialIsOn={strategyPreferences.chainIdExclusions === undefined || strategyPreferences.chainIdExclusions.indexOf(cid) < 0}
          onToggle={toggleChainIdForStrategyPreferences.bind(null, cid)}
        />
      </div>)}
    </div>}
    <button
      type="button"
      className="mt-4 w-full focus:outline-none rounded-md p-3.5 font-medium bg-primary sm:hover:bg-primary-darker active:scale-95 text-white"
      onClick={onClickSendPayLink}
    >
      Send Pay Link
    </button>
    {checkout && checkoutLink && <Modal showModalNonce={showModalNonce}>
      <div className="w-full h-fit flex flex-col items-center justify-center gap-4">
        <span>Share this link to get paid</span>
        <QRCode data={checkoutLink} />
        <button
          type="button"
          className="rounded-md p-5 bg-primary text-white sm:enabled:hover:bg-primary-darker sm:enabled:hover:cursor-pointer w-full"
          disabled={isCheckoutLinkCopied} onClick={() => {
            const toShare = {
              // title: "Payment request", // we omit title because some share contexts include it, some omit it, and we prefer our share content to be minimalist and consistently include no title
              text: checkoutTextToShare,
              url: checkoutLink,
            };
            if (navigator.canShare && navigator.canShare(toShare)) { // test the Web Share API on desktop by enabling this flag chrome://flags/#web-share
              navigator.share(toShare).catch(e => console.warn(e));
            } else setIsCheckoutLinkCopied();
          }}>
          {isCheckoutLinkCopied ? <span className="text-xl">Link Copied</span> : <span className="flex items-center justify-center text-xl gap-2">Share Link<FaShareAlt /></span>}
        </button>
        {!isProduction && <a href={checkoutLink} target="_blank" rel="noopener noreferrer"><span className="text-xl text-primary sm:hover:text-primary-darker sm:hover:cursor-pointer">Open Link</span></a> /* this is a development feature to make it easy to access the Pay UI for this request */}
      </div>
    </Modal>}
  </div>;
}

function countCharsAfterDecimal(s: string): number {
  const decimalIndex = s.indexOf('.');
  if (decimalIndex > -1) {
    return s.length - decimalIndex - 1;
  } else return 0;
}
