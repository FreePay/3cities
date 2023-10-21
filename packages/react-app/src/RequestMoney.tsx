import { isAddress } from "@ethersproject/address";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CurrencyInput from "react-currency-input-field";
import { FaCheckCircle, FaExclamationCircle, FaRegCopy, FaRegQuestionCircle, FaTimesCircle } from "react-icons/fa";
import useClipboard from "react-use-clipboard";
import { toast } from "sonner";
import { useImmer } from "use-immer";
import { useAccount, useDisconnect } from "wagmi";
import { CheckoutSettings } from "./CheckoutSettings";
import { serializedCheckoutSettingsUrlParam } from "./CheckoutSettingsProvider";
import { ConnectWalletButtonCustom } from "./ConnectWalletButton";
import { Modal, useModal } from "./Modal";
import { ProposedPayment, isProposedPaymentWithFixedAmount } from "./Payment";
import QRCode from "./QRCode";
import { renderLogicalAssetAmount } from "./RenderLogicalAssetAmount";
import { Spinner } from "./Spinner";
import { StrategyPreferences } from "./StrategyPreferences";
import { ToggleSwitch } from "./ToggleSwitch";
import { allSupportedChainIds, getSupportedChainName } from "./chains";
import { isLikelyAnEnsName } from "./isLikelyAnEnsName";
import { isProduction } from "./isProduction";
import { LogicalAssetTicker, getDecimalsToRenderForLogicalAssetTicker, logicalAssetsByTicker, parseLogicalAssetAmount } from "./logicalAssets";
import { isTokenTickerSupportedByLogicalAsset } from "./logicalAssetsToTokens";
import { addToRecentlyUsed, getMostRecentlyUsed, removeFromRecentlyUsed } from "./recentlyUsed";
import { serializeCheckoutSettings, serializeCheckoutSettingsWithEncryption, serializeCheckoutSettingsWithSignature } from "./serialize";
import { allTokenTickers } from "./tokens";
import { truncateEthAddress, truncateEthAddressVeryShort } from "./truncateAddress";
import { useAsyncMemo } from "./useAsyncMemo";
import useDebounce from "./useDebounce";
import { useEnsAddress } from "./useEnsAddress";
import { useEnsName } from "./useEnsName";
import { useInput } from "./useInput";

// TODO consider converting manual <input>s into useInput --> I started trying to do this for the receiver input, but encountered a challenge and abandoned the effort. The problem is that there's a use-before-declare circular dependency rawReceiver->computedReceiver/addressForDebouncedRawReceiverEnsName->rawReceiverInputParams->circular. In the current impl with an inline <input>, this circular dependency is resolved by adding a layer of indirection where the input's inline onChange sets the rawReceiver, so rawReceiver can be defined above the input. But with the useInput hook, the hook returns the actual current value (as opposed to setting it indirectly in a callback), so in order to use the useInput hooks, a bit more work is needed, and/or perhaps a modification to useInput API. Here was my work in progress:
// const rawReceiverInputParams = useMemo(() => {
//   return {
//     className: `w-full rounded-md border px-3.5 py-2 leading-6 ${computedReceiver && !addressForDebouncedRawReceiverEnsName ? 'text-xs' : ''}`,
//     id: "rawReceiver",
//     type: "text",
//     placeholder: "Ethereum address or ENS",
//   };
// }, [computedReceiver, addressForDebouncedRawReceiverEnsName]);
// const [rawReceiverNew, rawReceiverInput, setRawReceiverNew] = useInput('', rawReceiverInputParams, { onEnterKeyPress: (e) => e.currentTarget.blur() });

const amountInputId = "amount-input";
const amountRawDefault = "0"; // Q: why set amountRawDefault to "0" instead of undefined? A: It's because when the amount input is reset by the user clicking the X, we execute the reset by setting amountRaw to its initial value, but if this initial value is undefined, then CurrencyInput doesn't actually get reset because CurrencyInput defines passing value=undefined to mean "disregard this passed value and maintain amount as internal state"
const amountInputWidthDefault = 1; // width to fit amountRawDefault

const recentlyUsedReceiversKey = "receivers";

export const RequestMoney: React.FC = () => {
  const [logicalAssetTicker, setLogicalAssetTicker] = useState<LogicalAssetTicker>('USD');
  const logicalAsset = logicalAssetsByTicker[logicalAssetTicker];

  const [amountInputWidth, setAmountInputWidth] = useState(amountInputWidthDefault);
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
      if (sRawInput.startsWith('.') && sRawInput.length === 2) return `0${sRawInput}`; // sRawInput can of the form ".<digit>" iff the user (repeatedly) hits backspace to fully clear the input and then initially types a period followed by a digit. If instead the user hits the "X" to clear the input amount or the input has initially loaded, then the amount is set to the default 0, and if the user then types a period, that period will be appended to the 0, resulting in an sRawInput value of "0.", which does not trigger the edge case here. But in this edge case of sRawInput being ".<digit>", CurrencyInput postprocess prepends a 0 and renders "0.<digit>", resulting in an incorrect render width because the width was calculated here using ".<digit>". So in this case we prepend the 0 before calculating render width
      else return sRawInput;
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

  const [note, setNote] = useState<string>('');

  const [rawReceiver, setRawReceiver] = useState<string>('');
  const flushDebounce = rawReceiver.length < 1 || isAddress(rawReceiver) || isLikelyAnEnsName(rawReceiver); // if rawReceiver is empty, a valid address, or likely to be an ens name, then we'll flush (ie. skip over) the debounce, which makes the UI a bit snappier when pasting or deleting an address or ens name
  const debouncedRawReceiver = useDebounce(rawReceiver, 500, flushDebounce);

  const { address: addressForDebouncedRawReceiverEnsName, isLoading: addressForDebouncedRawReceiverEnsNameIsLoading } = useEnsAddress(debouncedRawReceiver); // the resolved ethereum address for the ENS name which the user typed into the receiver input. NB here we do nothing with the returned error which is fine because instead, below, we show a visual warning if a non-empty debouncedRawReceiver results in an empty computedReceiver (for which one possible but not the only root cause is an error here)

  const clearRawReceiver = useCallback(() => setRawReceiver(''), [setRawReceiver]);

  const { address: connectedWalletAddress, isConnected } = useAccount({ onConnect: clearRawReceiver }); // here we must clear rawReceiver when wallet connects to avoid an inconsistent state where the value of rawReceiver is stale (something previously typed) prior to wallet being connected
  const connectedWalletAddressRendered: string | undefined = connectedWalletAddress ? truncateEthAddress(connectedWalletAddress) : undefined; // NB we eagerly calculate connectedWalletAddressRendered to use it as the default value of computedReceiverRendered. If we didn't do this and instead defaulted computedReceiverRendered to undefined, and if the user's wallet is already connected on component mount, the first render from shows "Receive money at <nothing>" until the useEffect runs to set it. A long-term solution may be to migrate to a modern state management library like jotai that provides atomic renders for derived state, which offers benefits of (i) preventing renders from occuring before initial derived state is rendered and (ii) eliminating redundant rerenders from multiple useEffects calculate derived states (ie. jotai calculates any amount of derived state atomically before the next render).

  const { ensName: ensNameForConnectedWalletAddress } = useEnsName(connectedWalletAddress);

  const [
    computedReceiver, // the receiver to which the requested money will be sent
    computedReceiverRendered, // the rendering of the ethereum address to which the money will be sent, suitable to display to the user
  ] = useMemo<[ProposedPayment['receiver'], string] | [undefined, undefined]>(() => { // a small state machine to determine and set the computed receiver based on the different ways it can be provided
    if (connectedWalletAddress && isConnected && isAddress(connectedWalletAddress)) { // here we sanity check that the connected address is actually a valid ethereum address. If it wasn't for any reason, the payment link would fail at pay time for the sender
      if (!connectedWalletAddressRendered) throw new Error("connectedWalletAddressRendered unexpectedly undefined"); // NB typescript can't tell that connectedWalletAddressRendered is always defined here because it's a function of connectedWalletAddress, so we add this if statement or else the return value here isn't the return type of the function
      return [
        ensNameForConnectedWalletAddress ? { ensName: ensNameForConnectedWalletAddress } : { address: connectedWalletAddress }, // NB we prioritize setting the receiver to the ens name reverse resolution of the connected wallet address. This helps receivers with connected wallets to automatically benefit from their primary ens name, and also makes generated links shorter because serialized ens names are typically shorter than serialized addresses
        ensNameForConnectedWalletAddress || connectedWalletAddressRendered,
      ];
    } else if (addressForDebouncedRawReceiverEnsName && isAddress(addressForDebouncedRawReceiverEnsName)) { // here we sanity check that the returned addressForEnsName is actually a valid ethereum address. If it wasn't for any reason, the payment link would fail at pay time for the sender
      return [
        { ensName: debouncedRawReceiver }, // here, debouncedRawReceiver is known to be an ENS name because its forward resolution to an address succeeded, so we prioritize setting the receiver to the ens name as this is what the user typed in
        debouncedRawReceiver, // here, debouncedRawReceiver is known to be an ENS name because its forward resolution to an address succeeded
      ];
    } else if (isAddress(debouncedRawReceiver)) {
      return [
        { address: debouncedRawReceiver },
        truncateEthAddress(debouncedRawReceiver),
      ];
    } else return [undefined, undefined];
  }, [debouncedRawReceiver, addressForDebouncedRawReceiverEnsName, connectedWalletAddress, isConnected, ensNameForConnectedWalletAddress, connectedWalletAddressRendered]);

  const [strategyPreferences, setStrategyPreferences] = useImmer<StrategyPreferences | undefined>(undefined);

  // TODO consider deleting strategyPreferences.acceptedTokenTickers when logicalAsset changes. Currently, this is disabled because it's a polish feature and would be incorrect if we add forex payments (eg. pay ETH to settle USD payment). Here is code to do this:
  // useEffect(() => { // delete token strategy preferences when the logical asset changes because the old token preferences aren't relevant to the new logical asset because we currently support settling a payment only with tokens supported by the payment's logical asset (eg. you can't currently pay an ETH token to settle a USD payment), so each logical asset's supported tokens are disjoint
  //   setStrategyPreferences(draft => {
  //     if (draft) delete draft['acceptedTokenTickers'];
  //   });
  // }, [setStrategyPreferences, logicalAssetTicker])

  const toggleTokenTickerForStrategyPreferences = useCallback((tt: string) => {
    // TODO support allowlist
    setStrategyPreferences(draft => {
      if (draft === undefined) {
        console.error("toggleTokenTickerForStrategyPreferences: strategyPreferences unexpectedly undefined");
      } else if (draft.acceptedTokenTickers?.denylist === undefined) draft.acceptedTokenTickers = { denylist: new Set([tt]) };
      else {
        if (draft.acceptedTokenTickers.denylist.has(tt)) {
          draft.acceptedTokenTickers.denylist.delete(tt);
          if (draft.acceptedTokenTickers.denylist.size === 0) delete draft.acceptedTokenTickers;
        }
        else draft.acceptedTokenTickers.denylist.add(tt);
      }
    });
  }, [setStrategyPreferences]);

  const toggleChainIdForStrategyPreferences = useCallback((cid: number) => {
    // TODO support allowlist
    setStrategyPreferences(draft => {
      if (draft === undefined) {
        console.error("toggleChainIdForStrategyPreferences: strategyPreferences unexpectedly undefined");
      } else if (draft.acceptedChainIds?.denylist === undefined) draft.acceptedChainIds = { denylist: new Set([cid]) };
      else {
        if (draft.acceptedChainIds.denylist.has(cid)) {
          draft.acceptedChainIds.denylist.delete(cid);
          if (draft.acceptedChainIds.denylist.size === 0) delete draft.acceptedChainIds;
        } else draft.acceptedChainIds.denylist.add(cid);
      }
    });
  }, [setStrategyPreferences]);

  const toggleUseOfStrategyPreferences = useCallback((isOnAndNotUsingStrategyPrefs: boolean) => {
    if (isOnAndNotUsingStrategyPrefs) setStrategyPreferences(undefined);
    else setStrategyPreferences({});
  }, [setStrategyPreferences]);

  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const [privacyAndSecurityMode, setPrivacyAndSecurityMode] = useState<'standard' | 'encrypted' | 'signed'>('standard');

  const [showPassword, setShowPassword] = useState(false);

  const passwordInputAttrs = useMemo<Parameters<typeof useInput>[1]>(() => ({
    name: "password",
    type: showPassword ? "text" : "password",
    className: "w-full rounded-md border px-3.5 py-2 leading-6",
    placeholder: "Password",
    autoComplete: "off",
  }), [showPassword]);
  const passwordInputOpts = useMemo<Parameters<typeof useInput>[2]>(() => ({ onEnterKeyPress: (e) => e.currentTarget.blur() }), []);
  const [password, passwordInput, setPassword] = useInput("", passwordInputAttrs, passwordInputOpts);

  const [successRedirectOpenInNewTab, setSuccessRedirectOpenInNewTab] = useState(true);
  const successRedirectUrlInputAttrs = useMemo<Parameters<typeof useInput>[1]>(() => ({
    name: "successRedirectUrl",
    type: "text",
    className: "w-full rounded-md border px-3.5 py-2 leading-6",
    placeholder: "Redirect URL",
    autoComplete: "off",
  }), []);
  const successRedirectUrlInputOpts = useMemo<Parameters<typeof useInput>[2]>(() => ({ onEnterKeyPress: (e) => e.currentTarget.blur() }), []);
  const [successRedirectUrl, successRedirectUrlInput, setSuccessRedirectUrl] = useInput("", successRedirectUrlInputAttrs, successRedirectUrlInputOpts);

  useEffect(() => { // reset advanced options to defaults when advanced options are hidden. If we don't, then eg. user will turn advanced options off and send link, and not realize they sent an encrypted link because they had turned encryption before turning advanced options off
    if (!showAdvancedOptions) {
      setPrivacyAndSecurityMode('standard');
      setShowPassword(false);
      setPassword('');
      setSuccessRedirectOpenInNewTab(true);
      setSuccessRedirectUrl('');
    }
  }, [showAdvancedOptions, setPrivacyAndSecurityMode, setShowPassword, setPassword, setSuccessRedirectUrl]);

  const checkoutSettings = useMemo<CheckoutSettings | undefined>(() => {
    if (
      amount && amount > 0 // can't build checkoutSettings without an amount
      && computedReceiver // can't build checkoutSettings without a receiver
      && (privacyAndSecurityMode === 'standard' || password.length > 0) // can't build checkoutSettings that requires a password if the password is empty
    ) {
      return {
        proposedPayment: { // TODO perhaps this ProposedPayment literal should be constructed in a centralized function to ensure that it's done correctly and consistently everywhere (but I think these literals are built nowhere else right now)
          logicalAssetTicker,
          paymentMode: { // TODO support PayWhatYouWant
            logicalAssetAmountAsBigNumberHexString: parseLogicalAssetAmount(amount.toString()).toHexString(),
          },
          receiver: computedReceiver,
        },
        receiverStrategyPreferences: strategyPreferences || {},
        ...(note && { note: note.trim() }),
        senderNoteSettings: { mode: 'NONE' }, // TODO support senderNoteSettings
        ...(successRedirectUrl.length > 0 && {
          successRedirect: {
            url: successRedirectUrl,
            openInNewTab: successRedirectOpenInNewTab,
          },
        }),
        // TODO support webhookUrl
      } satisfies CheckoutSettings;
    } else return undefined;
  }, [logicalAssetTicker, amount, computedReceiver, note, strategyPreferences, privacyAndSecurityMode, password, successRedirectUrl, successRedirectOpenInNewTab]);

  const { value: serializedCheckoutSettings, isLoading: serializedCheckoutSettingsIsLoading } = useAsyncMemo<string | undefined>(async () => {
    if (checkoutSettings) {
      const s: string | undefined = await (() => {
        switch (privacyAndSecurityMode) {
          case 'standard': return serializeCheckoutSettings(checkoutSettings)
          case 'encrypted': return serializeCheckoutSettingsWithEncryption(checkoutSettings, password)
          case 'signed': return serializeCheckoutSettingsWithSignature(checkoutSettings, password)
        }
      })();
      if (!s) console.warn('Pay Link encryption unavailable in insecure browser contexts');
      return s;
    } else return undefined;
  }, [privacyAndSecurityMode, password, checkoutSettings]);

  const checkoutLink = useMemo<string | undefined>(() => {
    // WARNING we might be tempted to remove the "http://" and "https://" from checkoutLink to make it a bit shorter when pasted. However, the URL protocol is required for the link to be considered valid by the WebShare API, and <a> tags will consider an URL to be a relative link if it contains no protocol, and 3rd party link parsers (to make a pasted link clickable) often require the protocol to properly detect the link, eg. discord won't make "3cities.xyz" clickable without an URL protocol
    if (serializedCheckoutSettings && !serializedCheckoutSettingsIsLoading) return `${process.env['REACT_APP_DEVELOPMENT_INTRANET_IP'] ? `http://${process.env['REACT_APP_DEVELOPMENT_INTRANET_IP']}${location.port.length > 0 ? `:${location.port}` : ''}` : location.hostname}/#/pay?${serializedCheckoutSettingsUrlParam}=${serializedCheckoutSettings}`; // REACT_APP_DEVELOPMENT_INTRANET_IP is a development feature. Set it in .env.local so that payment links generated on your laptop can be opened on your phone using the LAN
    else return undefined;
  }, [serializedCheckoutSettings, serializedCheckoutSettingsIsLoading]);

  const amountInputContainerStyle = useMemo(() => {
    return { width: `${amountInputWidth}ch` };
  }, [amountInputWidth]);

  const [showModalNonce, setShowModalNonce] = useState(0);
  const incrementShowModalNonce = useCallback(() => setShowModalNonce(n => n + 1), [setShowModalNonce]);
  useEffect(() => {
    setShowModalNonce(0); // NB we must reset showModalNonce when checkout changes, otherwise the modal will pop up without the user clicking request once checkout is redefined.
  }, [setShowModalNonce, checkoutSettings]);

  const { value: recentlyUsedReceivers, forceRecache: recacheRecentlyUsedReceivers } = useAsyncMemo(() => getMostRecentlyUsed<string>(recentlyUsedReceiversKey), [], []);

  const renderedLogicalAssetAmount: string | undefined = checkoutSettings && isProposedPaymentWithFixedAmount(checkoutSettings.proposedPayment) ? renderLogicalAssetAmount({ // TODO support PayWhatYouWant
    logicalAssetTicker: checkoutSettings.proposedPayment.logicalAssetTicker,
    amountAsBigNumberHexString: checkoutSettings.proposedPayment.paymentMode.logicalAssetAmountAsBigNumberHexString,
  }) : undefined;

  const checkoutTextToShare: string = (() => {
    if (renderedLogicalAssetAmount) return `Hey, can you please pay me ${renderedLogicalAssetAmount} using this link`;
    else return ' ';
  })();

  const { disconnect } = useDisconnect();

  const currencyInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { // when the user is typing the currency amount, we automatically blur the currency amount input if the user hits the enter key. On mobile, this has the convenient effect of enabling the user to close the number pad by hitting the enter key instead of having to tap outside the number pad.
    const handleKeyDown = (event: KeyboardEvent) => { // TODO right now, this handler fires if Enter is pressed any time the page is loaded. Can we apply the event handler only to currencyInputRef? Eg. can we check that the passed event's target is currencyInputRef?
      if (event.key === 'Enter' || event.keyCode === 13) currencyInputRef.current?.blur();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [showAmountRequiredWarning, setShowAmountRequiredWarning] = useState(false); // if the user clicks Send Pay Link before filling in an amount, we'll show a warning that amount is a required field
  const [showReceiverRequiredWarning, setShowReceiverRequiredWarning] = useState(false); // if the user clicks Send Pay Link before filling in a receiver, we'll show a warning that receiver is a required field
  const [showPasswordRequiredWarning, setShowPasswordRequiredWarning] = useState(false); // if the user clicks Send Pay Link before filling in a password while privacyAndSecurityMode is encrypted or signed, we'll show a warning that password is a required field

  const onClickSendPayLink = useCallback(() => {
    if (checkoutSettings) { // NB some implicit control flow: here we check only that checkoutSettings is defined before showing the pay link share modal, but the modal depends on checkoutLink which may be undefined even if checkoutSettings is defined due to asynchronous generation of serializedCheckoutSettings. In this case, the modal will simply pop-up as soon as checkoutLink becomes available.
      setShowAmountRequiredWarning(false);
      setShowReceiverRequiredWarning(false);
      setShowPasswordRequiredWarning(false);
      incrementShowModalNonce();
      addToRecentlyUsed(recentlyUsedReceiversKey, checkoutSettings.proposedPayment.receiver.address || checkoutSettings.proposedPayment.receiver.ensName).then(recacheRecentlyUsedReceivers);
    } else {
      // NB here we set each warning flag to true if its required data are missing, but we never set them to false here because, as a UX design decision, we never clear warnings until the checkout link has been successfully generated (at which point we clear all warning flags, ie. in the if branch of this conditional)
      if (!(amount && amount > 0)) setShowAmountRequiredWarning(true);
      if (!computedReceiver) setShowReceiverRequiredWarning(true);
      if (!(privacyAndSecurityMode === 'standard' || password.length > 0)) setShowPasswordRequiredWarning(true);
    }
  }, [incrementShowModalNonce, setShowAmountRequiredWarning, setShowReceiverRequiredWarning, setShowPasswordRequiredWarning, amount, checkoutSettings, computedReceiver, recacheRecentlyUsedReceivers, privacyAndSecurityMode, password]);

  const { modal: privacyAndSecurityInfoModal, showModal: showPrivacyAndSecurityInfoModal } = useModal(<div className="w-full h-fit flex flex-col items-center justify-center gap-6">
    <span className="text-left w-full text-xl">Privacy & Security Options</span>
    <span className="text-left w-full text-lg"><span className="font-bold">Standard Security</span> - Pay Link details stored offchain, visible only through shared link.</span>
    <span className="text-left w-full text-lg"><span className="font-bold">Encrypted</span> - Like Standard Security, but details encrypted. Share password separately.</span>
    <span className="text-left w-full text-lg"><span className="font-bold">Anti-phishing</span> - Like Standard Security, not encrypted, but tamper-proof. Share password separately.</span>
  </div>);

  return <div className="mt-[3vh] w-full max-w-sm mx-auto flex flex-col items-center justify-center">
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
      {showReceiverRequiredWarning && <span className="text-red-600">(required)</span>}
    </div>
    {connectedWalletAddress && isConnected && <div className="w-full flex flex-wrap justify-between items-center gap-2 mt-2">
      <span className="w-full break-words">{computedReceiverRendered}</span>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-xs font-medium focus:outline-none bg-primary sm:enabled:hover:bg-primary-darker  enabled:active:scale-95 text-white"
        onClick={() => disconnect()}
      >
        Disconnect to change
      </button>
    </div>}
    {!(connectedWalletAddress && isConnected) && <div className="flex flex-col justify-center w-full gap-2 mt-2">
      <div className="flex justify-start items-center w-full">
        <div className="w-full relative">
          <input
            id={"rawRecipient" /* this id isn't actually used by anything in the codebase, but if omitted, Chrome reports the issue "A form field element has neither an id nor a name attribute." */}
            className={`w-full rounded-md border px-3.5 py-2 leading-6 ${computedReceiver && !addressForDebouncedRawReceiverEnsName ? 'text-xs' : ''}`}
            type="text"
            placeholder="Ethereum address or ENS"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.keyCode === 13) e.currentTarget.blur();
            }}
            onChange={(e) => setRawReceiver(e.target.value)}
            value={rawReceiver}
            spellCheck={false}>
          </input>
          <div className={`absolute top-1/2 transform -translate-y-1/2 right-1 flex justify-right items-center ${computedReceiver ? '' : 'hidden'}`}>
            {addressForDebouncedRawReceiverEnsName && <span className="text-gray-600">{truncateEthAddress(computedReceiver?.address) /* here we know computedReceiver.address is defined because it was used to successfully fetch addressForDebouncedRawReceiverEnsName */}</span>}
            <div className="z-10 bg-white px-2"><FaCheckCircle className="text-primary" /></div>
          </div>
          <div className={`absolute top-1/2 transform -translate-y-1/2 right-1 text-red-500 ${debouncedRawReceiver.length > 0 && !computedReceiver && !addressForDebouncedRawReceiverEnsNameIsLoading ? '' : 'hidden'}`}>
            <div className="z-10 bg-white px-2"><FaExclamationCircle className="text-red-500" /></div>
          </div>
          <div className={`absolute top-1/2 transform -translate-y-1/2 right-1 text-red-500 ${debouncedRawReceiver.length > 0 && !computedReceiver && addressForDebouncedRawReceiverEnsNameIsLoading ? '' : 'hidden'}`}>
            <div className="z-10 bg-white px-2"><Spinner
              containerClassName="absolute top-1/2 transform -translate-y-1/2 right-2 z-10 h-4 w-4 flex items-center justify-center"
              spinnerClassName='text-primary'
            /></div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-start items-center gap-2">
        <ConnectWalletButtonCustom
          disconnectedLabel="Use Wallet"
          className="flex-none rounded-md px-3 py-1 text-xs font-medium focus:outline-none bg-primary sm:enabled:hover:bg-primary-darker enabled:active:scale-95 text-white"
          disabledClassName="text-gray-200 pointer-events-none"
          loadingSpinnerClassName="text-gray-200 fill-primary"
        />
        {recentlyUsedReceivers.map((r, i) => <button key={i} className="flex-none flex items-center gap-2 rounded-md px-3 py-1 text-xs font-medium focus:outline-none bg-primary sm:enabled:hover:bg-primary-darker enabled:active:scale-95 text-white" onClick={() => setRawReceiver(r)}><span>{isAddress(r) ? truncateEthAddressVeryShort(r) : r}</span><span className="p-0.5" onClick={(evt) => {
          evt.stopPropagation(); // stop event from bubbling which would cause the parent button onClick to fire
          removeFromRecentlyUsed(recentlyUsedReceiversKey, r).then(recacheRecentlyUsedReceivers);
        }}><FaTimesCircle /></span>
        </button>)}
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
          initialIsOn={strategyPreferences.acceptedTokenTickers?.denylist === undefined || !strategyPreferences.acceptedTokenTickers.denylist.has(tt) /* TODO support allowlist */}
          onToggle={toggleTokenTickerForStrategyPreferences.bind(null, tt)}
        />
      </div>)}
      {allSupportedChainIds.map(cid => <div key={cid}>
        <ToggleSwitch
          offLabel={getSupportedChainName(cid)}
          className="gap-0.5"
          initialIsOn={strategyPreferences.acceptedChainIds?.denylist === undefined || !strategyPreferences.acceptedChainIds.denylist.has(cid) /* TODO support allowlist */}
          onToggle={toggleChainIdForStrategyPreferences.bind(null, cid)}
        />
      </div>)}
    </div>}
    <div className="mt-4 w-full flex justify-between items-center gap-4">
      <span className="grow">Basic settings</span>
      <ToggleSwitch initialIsOn={!showAdvancedOptions} onToggle={(v) => setShowAdvancedOptions(!v)} offClassName="text-gray-500" className="font-bold text-3xl" />
    </div>
    {showAdvancedOptions && <>
      <div className="w-full flex flex-wrap justify-between items-center gap-2 mt-4">
        <div className="flex justify-start items-center gap-1">
          <span className="w-full" onClick={showPrivacyAndSecurityInfoModal}>Privacy &amp; Security</span>
          <FaRegQuestionCircle className="text-lg" />
          {privacyAndSecurityInfoModal}
        </div>
        <div className="grow flex justify-between gap-4">
          <button
            type="button"
            disabled={privacyAndSecurityMode === 'standard'}
            className="focus:outline-none rounded-md px-2 py-1 font-medium border border-primary enabled:active:scale-95 enabled:bg-white enabled:text-primary sm:enabled:hover:bg-primary sm:enabled:hover:text-white disabled:bg-primary disabled:text-white disabled:cursor-not-allowed"
            onClick={() => setPrivacyAndSecurityMode('standard')}
          >
            Standard
          </button>
          <button
            type="button"
            disabled={privacyAndSecurityMode === 'encrypted'}
            className="focus:outline-none rounded-md px-2 py-1 font-medium border border-primary enabled:active:scale-95 enabled:bg-white enabled:text-primary sm:enabled:hover:bg-primary sm:enabled:hover:text-white disabled:bg-primary disabled:text-white disabled:cursor-not-allowed"
            onClick={() => setPrivacyAndSecurityMode('encrypted')}
          >
            Encrypted
          </button>
          <button
            type="button"
            disabled={privacyAndSecurityMode === 'signed'}
            className="focus:outline-none rounded-md px-2 py-1 font-medium border border-primary enabled:active:scale-95 enabled:bg-white enabled:text-primary sm:enabled:hover:bg-primary sm:enabled:hover:text-white disabled:bg-primary disabled:text-white disabled:cursor-not-allowed"
            onClick={() => setPrivacyAndSecurityMode('signed')}
          >
            Anti-phishing
          </button>
        </div>
        {privacyAndSecurityMode !== 'standard' && passwordInput}
        {showPasswordRequiredWarning && <span className="text-red-600">(password required)</span>}
        {privacyAndSecurityMode !== 'standard' && <div className="w-full flex justify-start items-center gap-2">
          <span className="grow">Show password</span>
          <ToggleSwitch initialIsOn={showPassword} onToggle={setShowPassword} offClassName="text-gray-500" className="font-bold text-2xl" />
        </div>}
      </div>
      <div className="w-full flex flex-wrap justify-between items-center gap-2 mt-4">
        <span className="w-full">Redirect after paying</span>
        {successRedirectUrlInput}
        <div className="w-full flex justify-start items-center gap-2">
          <span className="grow">Redirect in new tab</span>
          <ToggleSwitch initialIsOn={successRedirectOpenInNewTab} onToggle={setSuccessRedirectOpenInNewTab} offClassName="text-gray-500" className="font-bold text-2xl" />
        </div>
      </div>
    </>
    }
    <button
      type="button"
      className="mt-4 w-full focus:outline-none rounded-md p-3.5 font-medium bg-primary sm:hover:bg-primary-darker active:scale-95 text-white"
      onClick={onClickSendPayLink}
    >
      Send Pay Link
    </button>
    {
      renderedLogicalAssetAmount && checkoutLink && <Modal showModalNonce={showModalNonce}>
        <SharePayLinkModalContent checkoutLink={checkoutLink} checkoutTextToShare={checkoutTextToShare} renderedLogicalAssetAmount={renderedLogicalAssetAmount} />
      </Modal>
    }
  </div >;
}

type SharePayLinkModalContentProps = {
  checkoutLink: string,
  checkoutTextToShare: string,
  renderedLogicalAssetAmount: string,
}

const SharePayLinkModalContent: React.FC<SharePayLinkModalContentProps> = ({ checkoutLink, checkoutTextToShare, renderedLogicalAssetAmount }) => {
  const [isCheckoutLinkCopied, setIsCheckoutLinkCopied] = useClipboard(checkoutLink || ' ', { // here we exclude checkoutTextToShare from the string copied to  clipboard because users seem to prefer that what's copied to the clipboard is the pure link vs the webshare API having the additional context provided by checkoutTextToShare
    successDuration: 2000,
  });

  const [isHtmlEmbedCopied, setIsHtmlEmbedCopied] = useClipboard(checkoutLink ? `<button style="color:#fff;background-color:#007bff;border-radius:5px;padding:10px 15px;border:none;cursor:pointer;" onclick="(function(){let m=document.createElement('div');m.style='position:fixed;top:0;left:0;width:100%;height:100%;background-color:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';m.onclick=function(e){if(e.target===m){removeModal();}};let removeModal=function(){if(document.body.contains(m)){document.body.removeChild(m);document.removeEventListener('keydown',escListener);}};let escListener=function(e){if(e.key==='Escape'){removeModal();}};document.addEventListener('keydown',escListener);let mc=document.createElement('div');let maxWidth = window.innerWidth < 420 ? (window.innerWidth - 30) + 'px' : '390px';mc.style='background-color:#f1f1f1;padding:8px;width:100%;max-width:' + maxWidth + ';height:95vh;max-height:1024px;border-radius:10px;position:relative;box-shadow:0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06);margin:auto;';let i=document.createElement('iframe');i.style='width:100%;height:100%;border:0;';i.src='${checkoutLink}';let c=document.createElement('div');c.style='position:absolute;top:5px;right:5px;width:24px;height:24px;cursor:pointer;z-index:10;';c.innerHTML='<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 20 20\\' fill=\\'currentColor\\' style=\\'width:100%;height:100%;\\'><path fill-rule=\\'evenodd\\' clip-rule=\\'evenodd\\' d=\\'M10 9.293l5.146-5.147a.5.5 0 01.708.708L10.707 10l5.147 5.146a.5.5 0 01-.708.708L10 10.707l-5.146 5.147a.5.5 0 01-.708-.708L9.293 10 4.146 4.854a.5.5 0 11.708-.708L10 9.293z\\'></path></svg>';c.onclick=function(){removeModal();};mc.appendChild(i);mc.appendChild(c);m.appendChild(mc);document.body.appendChild(m);})();">Pay ${renderedLogicalAssetAmount}</button>` : ' ', {
    successDuration: 4000,
  });

  const [isReactEmbedCopied, setIsReactEmbedCopied] = useClipboard(checkoutLink ? `<span dangerouslySetInnerHTML={{ __html: \`<button style="color:#fff;background-color:#007bff;border-radius:5px;padding:10px 15px;border:none;cursor:pointer;" onClick="(function(){let m=document.createElement('div');m.style='position:fixed;top:0;left:0;width:100%;height:100%;background-color:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';m.onclick=function(e){if(e.target===m){removeModal();}};let removeModal=function(){if(document.body.contains(m)){document.body.removeChild(m);document.removeEventListener('keydown',escListener);}};let escListener=function(e){if(e.key==='Escape'){removeModal();}};document.addEventListener('keydown',escListener);let mc=document.createElement('div');let maxWidth = window.innerWidth < 440 ? (window.innerWidth - 50) + 'px' : '390px';mc.style='background-color:#f1f1f1;padding:8px;width:100%;max-width:' + maxWidth + ';height:95vh;max-height:1024px;border-radius:10px;position:relative;box-shadow:0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06);margin:auto;';let i=document.createElement('iframe');i.style='width:100%;height:100%;border:0;';i.src='${checkoutLink}';let c=document.createElement('div');c.style='position:absolute;top:5px;right:5px;width:24px;height:24px;cursor:pointer;z-index:10;';c.innerHTML='<svg xmlns=\\\\'http://www.w3.org/2000/svg\\\\' viewBox=\\\\'0 0 20 20\\\\' fill=\\\\'currentColor\\\\' style=\\\\'width:100%;height:100%;\\\\'><path fill-rule=\\\\'evenodd\\\\' clip-rule=\\\\'evenodd\\\\' d=\\\\'M10 9.293l5.146-5.147a.5.5 0 01.708.708L10.707 10l5.147 5.146a.5.5 0 01-.708.708L10 10.707l-5.146 5.147a.5.5 0 01-.708-.708L9.293 10 4.146 4.854a.5.5 0 11.708-.708L10 9.293z\\\\'></path></svg>';c.onclick=function(){removeModal();};mc.appendChild(i);mc.appendChild(c);m.appendChild(mc);document.body.appendChild(m);})();">Pay ${renderedLogicalAssetAmount}</button>\` }}></span>` : ' ', {
    successDuration: 4000,
  });

  const toShare = {
    // title: "Payment request", // we omit title because some share contexts include it, some omit it, and we prefer our share content to be minimalist and consistently include no title
    text: checkoutTextToShare,
    url: checkoutLink,
  };
  const canShare: boolean = navigator.canShare && navigator.canShare(toShare); // test the Web Share API on desktop by enabling this flag chrome://flags/#web-share

  return <div className="w-full h-fit flex flex-col items-center justify-center gap-6">
    <span className="text-center w-full text-2xl">Share link to get paid</span>
    <div className="flex flex-col items-center justify-center">
      <QRCode data={checkoutLink} />
      <span className="text-center w-full">Scan code in their mobile wallet</span>
    </div>
    <div className="w-full flex gap-4">
      <button
        type="button"
        className="grow rounded-md p-5 bg-primary text-white sm:enabled:hover:bg-primary-darker sm:enabled:hover:cursor-pointer"
        disabled={!canShare && isCheckoutLinkCopied} onClick={() => {
          if (canShare) navigator.share(toShare).catch(e => console.warn(e));
          else setIsCheckoutLinkCopied();
        }}>
        {!canShare && isCheckoutLinkCopied ? <span className="text-xl">Copied!</span> : <span className="flex items-center justify-center text-xl gap-2">{canShare ? 'Share' : 'Copy'} Link</span>}
      </button>
      {canShare && <button
        type="button"
        className="flex-none rounded-md p-5 px-7 bg-primary text-white sm:enabled:hover:bg-primary-darker sm:enabled:hover:cursor-pointer"
        disabled={isCheckoutLinkCopied} onClick={() => {
          setIsCheckoutLinkCopied();
          toast.success(<div>Copied!</div>, {
            duration: 2000,
          });
        }}>
        {isCheckoutLinkCopied ? <span className="text-xl"><FaCheckCircle /></span> : <span className="flex items-center justify-center text-xl gap-2"><FaRegCopy /></span>}
      </button>}
    </div>
    <div className="w-full grid grid-cols-2 gap-4">
      <button
        type="button"
        className="grow rounded-md p-2.5 bg-primary text-white sm:enabled:hover:bg-primary-darker sm:enabled:hover:cursor-pointer text-sm"
        disabled={isHtmlEmbedCopied} onClick={() => {
          setIsHtmlEmbedCopied();
          toast.success(<div>Copied! Paste into HTML</div>, {
            duration: 4000,
          });
        }}>
        {isHtmlEmbedCopied ? <span>Copied!</span> : <span>HTML Embed</span>}
      </button>
      <button
        type="button"
        className="grow rounded-md p-2.5 bg-primary text-white sm:enabled:hover:bg-primary-darker sm:enabled:hover:cursor-pointer text-sm"
        disabled={isReactEmbedCopied} onClick={() => {
          setIsReactEmbedCopied();
          toast.success(<div>Copied! Paste into React app</div>, {
            duration: 4000,
          });
        }}>
        {isReactEmbedCopied ? <span>Copied!</span> : <span>React Embed</span>}
      </button>
    </div>

    {!isProduction && <a href={checkoutLink} target="_blank" rel="noopener noreferrer"><span className="text-xl text-primary sm:hover:text-primary-darker sm:hover:cursor-pointer">Open Link</span></a> /* this is a development feature to make it easy to access the Pay UI for this request */}
  </div>;
};

function countCharsAfterDecimal(s: string): number {
  const decimalIndex = s.indexOf('.');
  if (decimalIndex > -1) {
    return s.length - decimalIndex - 1;
  } else return 0;
}
