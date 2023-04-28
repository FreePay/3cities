import { isAddress } from "@ethersproject/address";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import CurrencyInput from "react-currency-input-field";
import { FaCheckCircle, FaExclamationCircle, FaShareAlt, FaTimesCircle } from "react-icons/fa";
import useClipboard from "react-use-clipboard";
import { useImmer } from "use-immer";
import { useAccount, useDisconnect } from "wagmi";
import { ReceiverProposedPayment } from "./agreements";
import { allSupportedChainIds, getSupportedChainName } from "./chains";
import { Checkout } from "./checkout";
import { ConnectWalletButtonCustom } from "./ConnectWalletButton";
import { isProduction } from "./isProduction";
import { logicalAssetsByTicker, parseLogicalAssetAmount } from "./logicalAssets";
import Modal from "./Modal";
import { Narrow } from "./Narrow";
import QRCode from "./QRCode";
import { renderLogicalAssetAmount } from "./RenderLogicalAssetAmount";
import { serializeToModifiedBase64 } from "./serialize";
import { StrategyPreferences } from "./StrategyPreferences";
import { ToggleSwitch } from "./ToggleSwitch";
import { allTokenTickers } from "./tokens";
import { truncateEthAddress, truncateEthAddressVeryShort } from "./truncateAddress";
import useDebounce from "./useDebounce";
import { useEnsAddress } from "./useEnsAddress";

// TODO convert manual <input>s into useInput

const amountInputId = "amount-input";

export const RequestMoney: React.FC = () => {
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [amountInputWidth, setAmountInputWidth] = useState(1);
  const [note, setNote] = useState<string>('');

  const [rawRecipient, setRawRecipient] = useState<string>('');
  const flushDebounce = rawRecipient.length < 1 || isAddress(rawRecipient); // if rawAddress is empty or a valid address, then we'll flush (ie. skip over) the debounce, which makes the UI a bit snappier when pasting or deleting an address
  const debouncedRawRecipient = useDebounce(rawRecipient, 500, flushDebounce);

  const { address: addressForEnsName, isLoading: addressForEnsNameIsLoading } = useEnsAddress(debouncedRawRecipient); // TODO do something with returned error, such as showing a warning to user or logging to console

  const [computedRecipient, setComputedRecipient] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (addressForEnsName && isAddress(addressForEnsName)) { // here we sanity check that the returned addressForEnsName is actually a valid ethereum address. If it wasn't for any reason, the payment link would fail at pay time for the payor
      setComputedRecipient(addressForEnsName);
    } else if (isAddress(debouncedRawRecipient)) setComputedRecipient(debouncedRawRecipient);
    else setComputedRecipient(undefined)
  }, [debouncedRawRecipient, addressForEnsName]);

  const { address: connectedWalletAddress, isConnected } = useAccount();
  useEffect(() => {
    if (connectedWalletAddress && isConnected && isAddress(connectedWalletAddress)) setComputedRecipient(connectedWalletAddress); // here we sanity check that the connected address is actually a valid ethereum address. If it wasn't for any reason, the payment link would fail at pay time for the payor.
    else setComputedRecipient(undefined);
  }, [setComputedRecipient, connectedWalletAddress, isConnected]);

  const [strategyPreferences, setStrategyPreferences] = useImmer<StrategyPreferences | undefined>(undefined);

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
        proposedAgreement: {
          logicalAssetTicker: 'USD',
          amountAsBigNumberHexString: parseLogicalAssetAmount(amount.toString()).toHexString(),
          toAddress: computedRecipient,
          ...(note && { note }),
          _p: false,
          _rpp: true,
        },
        strategyPreferences: strategyPreferences || {},
      });
    } else setCheckout(undefined);
  }, [setCheckout, amount, computedRecipient, note, strategyPreferences]);

  const [checkoutLink, setCheckoutLink] = useState<string | undefined>(undefined);
  useEffect(() => {
    setCheckoutLink(checkout && `${process.env['REACT_APP_DEVELOPMENT_INTRANET_IP'] ? ('http://' + process.env['REACT_APP_DEVELOPMENT_INTRANET_IP'] + ':' + location.port) : location.origin}/#/pay?c=${serializeToModifiedBase64(checkout)}`);
  }, [setCheckoutLink, checkout]);

  const amountInputContainerStyle = useMemo(() => {
    const o = { width: `${Math.max(1, amountInputWidth)}ch` };
    // console.log("updated style object", o, { amountInputWidth });
    return o;
  }, [amountInputWidth]);

  const [showModalNonce, setShowModalNonce] = useState(0);
  const incrementShowModalNonce = useCallback(() => setShowModalNonce(n => n + 1), [setShowModalNonce]);
  useEffect(() => {
    setShowModalNonce(0); // NB we must reset showModalNonce when checkout changes, otherwise the modal will pop up without the user clicking request once checkout is redefined.
  }, [setShowModalNonce, checkout]);

  const checkoutTextToShare: string = (() => {
    if (checkout) return `Hey, can you please pay me ${renderLogicalAssetAmount({ ...checkout.proposedAgreement, showAllZeroesAfterDecimal: true })}`;
    else return ' ';
  })();

  const checkoutLinkWithTextToShare: string = (() => {
    if (checkoutLink) return `${checkoutTextToShare} at ${checkoutLink}`;
    else return ' ';
  })();

  const [isCheckoutLinkCopied, setIsCheckoutLinkCopied] = useClipboard(checkoutLinkWithTextToShare, {
    successDuration: 10000, // `isCopied` will go back to `false` after 10000ms
  });

  const { disconnect } = useDisconnect();

  return <div className="mt-[15vh] w-full max-w-sm mx-auto flex flex-col items-center justify-center">
    {/* TODO extract this into a CurrencyAmountInput component: */}
    <div className="flex items-start justify-center ml-3">
      <label className="flex-none text-4xl font-medium text-black" htmlFor="amount">$</label>
      <div className="text-6xl font-bold" style={amountInputContainerStyle}>
        <CurrencyInput
          autoFocus={true /* NB autofocus on mobile will only successfully pop up the number pad if a user action triggered the script --> ie. if user refreshes page on /request-money, this won't pop up automatically, it's an anti-spam thing. But if the user switches routes eg. by clicking 'request money' then the pad will pop-up automatically on autofocous */}
          className={"rounded-md bg-inherit focus:outline-none w-full"}
          id={amountInputId}
          name="amount"
          placeholder="0"
          prefix=""
          allowNegativeValue={false}
          defaultValue={0}
          decimalsLimit={2}
          value={amount === 0 || amount === undefined ? 0 : undefined}
          transformRawValue={(sRaw) => {
            // here we take advantage of the fact that transformRawValue is called on each keystroke to dynamically update the width of the CurrencyInput container so that its width always corresponds to the length of the current value, including decimal places and commas. The reason we have to do this is because if we don't explicitly set the width of CurrencyInput, its child <input> seems to default to a strange static max width. Other methods attempted here included styles like w-min, w-max, w-fit, min-width, and max-width, but none of those actually changed the default width of the input element. It seems to be necessary to explicitly set the width of the <input>. So, we do this by setting it to `w-full` and then dynamically varying the width of the parent container div. Note that our dynamic width implementation sets the width using an inline style instead of with tailing classes because tailwind styles are JIT-compiled so one can't dynamically generate custom tailwind styles at runtime (eg. you can't dynamically generate w-[8ch]).

            // The weird idea here is that we need to calculate the true render width using the passed sRaw, noting that the true on-screen render width is different than sRaw because it's been postprocessed by CurrencyInput. This gives us the strange rules below:
            const s = sRaw.replace(/,/g, ""); // for the purpose of calculating width, strip out any commas because they are provided inconsistently based on internal render status of CurrencyInput. We will count the expected commas in render manually.
            const containsADecimal = s.indexOf('.') > -1;
            const numberOfDigitsBeforeDecimal = s.indexOf('.') > -1 ? s.indexOf('.') : s.length; // NB there can be multiple decimal characters in the passed string due to CurrencyInput internal render state.
            const numberOfCommas = Math.floor(numberOfDigitsBeforeDecimal / 4);
            const numberOfDigitsAfterDecimal = Math.min(2, countCharsAfterDecimal(s)); // NB there can be up to 3 digits after the decimal due to CurrencyInput internal render state (but never >=4 because of the limit of CurrencyInput.decimalsLimit={2}), so here we cap the number of digits after decimal at 2.

            const width = (
              // +1 per digit before 1st decimal:
              numberOfDigitsBeforeDecimal
              // +1 per digit after decimal:
              + numberOfDigitsAfterDecimal
              // +0.5 if contains at least one decimal (0.5 because this isn't a fixed-width font and commas and decimals are narrower. We tried also 0.33 and 0.4 and found 0.5 to be most reliable to avoid width being too narrow on mobile):
              + (containsADecimal ? 1 : 0) * 0.5
              // +0.5 per each comma (0.5 because this isn't a fixed-width font and commas and decimals are narrower. We tried also 0.33 and 0.4 and found 0.5 to be most reliable to avoid width being too narrow on mobile):
              + numberOfCommas * 0.5
              // -1 if string begins with a 0 because when the element initially loads or resets, the user's first keystroke will result in the string eg. "04" which we want to interpret as "4":
              + (sRaw.startsWith('0') ? -1 : 0)
            );
            setAmountInputWidth(width);
            return sRaw; // NB we return the (unmodified) passed sRaw because we're only using this hook to calculate render width and not to actually transform the raw value.
          }}
          onValueChange={(vs) => {
            if (vs === undefined) setAmount(undefined)
            else try {
              const v = parseFloat(vs);
              if (v > 0) setAmount(v);
              else setAmount(undefined);
            } catch (err) {
              console.warn(err);
            }
          }}
        />
      </div>
      <div className="p-1 text-xl" onClick={() => {
        setAmount(0);
        setAmountInputWidth(0); // here we must manually reset amountInputWidth as it's only automatically updated on CurrencyInput keystrokes
        const inputElement = document.getElementById(amountInputId);
        if (inputElement) {
          inputElement.focus();
        } else console.error(`Could not find element with id ${amountInputId} to focus after reseting amount to 0.`);
      }}>
        <FaTimesCircle className="text-gray-500" />
      </div>
    </div>
    {/* TODO extract the strategy preferences editor into its own component. For example, it could be reused to set a user's default strategy preferences in the "Me" page. NB see all the ideas/todos in StrategyPreferences.ts */}
    <div className="mt-8 w-full flex justify-between sm:justify-start items-center gap-4">
      <span className="grow">Default tokens and chains (recommended)</span>
      <ToggleSwitch initialIsOn={strategyPreferences === undefined} onToggle={toggleUseOfStrategyPreferences} offClassName="text-gray-500" className="font-bold text-3xl" />
    </div>
    {strategyPreferences !== undefined && <div className="flex flex-wrap w-full mt-2 gap-x-2 gap-y-1">
      {allTokenTickers.filter(t => logicalAssetsByTicker['USD'].supportedTokenTickers[t] === true /* TODO support more than US Dollar stablecoins */).map(tt => <div key={tt}>
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
    {connectedWalletAddress && isConnected && <div className="flex justify-start items-center w-full gap-2 mt-6">
      {/* NB there is a race condition here where computedRecipient is initially undefined on the first render and this causes a jank where the user sees "Receive money at <nothing>" on the first render. A good long-term solution to this might be to migrate to a state management library like jotai (spelling? no internet at the moment) that provides atomic renders for derived state, preventing redundant rerenders due to useEffects computing that derived state. --> we solve this race condition by falling back to connectedWalletAddress if computedRecipient is undefined. */}
      <span>Receive money at {addressForEnsName ? debouncedRawRecipient : truncateEthAddressVeryShort(computedRecipient || connectedWalletAddress, "•")}</span>
      <button
        type="button"
        className="flex-none rounded-md px-2 py-1 text-xs font-medium focus:outline-none bg-primary sm:enabled:hover:bg-primary-darker  enabled:active:scale-95 text-white"
        onClick={() => disconnect()}
      >
        Disconnect
      </button>
    </div>}
    {!(connectedWalletAddress && isConnected) && <div className="flex flex-col justify-center items-starts w-full gap-2 mt-6">
      <div className="flex justify-start items-center w-full">
        <div className="w-full relative">
          <input className={`w-full rounded-md border px-3.5 py-2 leading-6 ${computedRecipient && !addressForEnsName ? 'text-xs' : ''}`} id="note" type="text" placeholder="Address or ENS to receive money" onChange={(e) => setRawRecipient(e.target.value)} value={rawRecipient} spellCheck={false}></input>
          <div className={`absolute top-1/2 transform -translate-y-1/2 right-1 flex justify-right items-center ${computedRecipient ? '' : 'hidden'}`}>
            {addressForEnsName && <span className="text-gray-600">{truncateEthAddress(computedRecipient, "••")}</span>}
            <div className="z-10 bg-white px-2"><FaCheckCircle className="text-primary" /></div>
          </div>
          <div className={`absolute top-1/2 transform -translate-y-1/2 right-1 text-red-500 ${debouncedRawRecipient.length > 0 && !computedRecipient && !addressForEnsNameIsLoading ? '' : 'hidden'}`}>
            <div className="z-10 bg-white px-2"><FaExclamationCircle className="text-red-500" /></div>
          </div>
        </div>
      </div>
      <div className="flex justify-end items-center gap-2">
        <span className="">or receive with</span>
        <ConnectWalletButtonCustom
          disconnectedLabel="Connect Wallet (optional)"
          className="flex-none rounded-md px-3 py-1 text-sm font-medium focus:outline-none bg-primary sm:enabled:hover:bg-primary-darker  enabled:active:scale-95 text-white"
          disabledClassName="text-gray-200 pointer-events-none"
          loadingSpinnerClassName="text-gray-200 fill-primary"
        />
      </div>
    </div>}
    <div className="flex justify-start items-center w-full mt-6">
      <input className="w-full rounded-md border px-3.5 py-2" id="note" type="text" placeholder="What's this for? (optional)" onChange={(e) => setNote(e.target.value)} value={note} spellCheck={false}></input>
    </div>
    {/* TODO instead of disabling request button when checkout is undefined, we should always let the customer click the request button, and if they click it while checkout is undefined, we should display feedback to help them complete the definition. Eg. "! Enter an amount more than $0" */}
    <button
      type="button"
      disabled={!checkout}
      className="mt-6 w-full focus:outline-none rounded-md p-3.5 font-medium bg-primary sm:enabled:hover:bg-primary-darker  enabled:active:scale-95 text-gray-700 enabled:text-white"
      onClick={incrementShowModalNonce}
    >
      Request
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
              title: "Payment request",
              text: checkoutTextToShare,
              url: checkoutLink,
            };
            if (navigator.canShare && navigator.canShare(toShare)) {
              navigator.share(toShare);
            } else setIsCheckoutLinkCopied();
          }}>
          {isCheckoutLinkCopied ? 'Copied link. Paste to them in a DM' : <span className="flex items-center justify-center text-xl gap-2">Share Link<FaShareAlt /></span>}
        </button>
        {!isProduction && <a href={checkoutLink} target="_blank" rel="noopener noreferrer"><span className="text-xl text-primary sm:hover:text-primary-darker sm:hover:cursor-pointer">Open Link</span></a> /* NB this is a development feature to make it easy to access the Pay UI for this request */}
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
