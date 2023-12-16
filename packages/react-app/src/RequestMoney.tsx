import { isAddress } from "@ethersproject/address";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaRegCopy, FaTimesCircle } from "react-icons/fa";
import useClipboard from "react-use-clipboard";
import { toast } from "sonner";
import { useImmer } from "use-immer";
import { useAccount, useDisconnect } from "wagmi";
import { CheckoutSettings } from "./CheckoutSettings";
import { serializedCheckoutSettingsUrlParam } from "./CheckoutSettingsProvider";
import { ConnectWalletButtonCustom } from "./ConnectWalletButton";
import { CurrencyAmountInput } from "./CurrencyAmountInput";
import { Modal, useModal } from "./Modal";
import { PaymentMode, ProposedPayment, isPaymentModeWithFixedAmount, isProposedPaymentWithFixedAmount } from "./Payment";
import { PrimaryWithSecondaries } from "./PrimaryWithSecondaries";
import QRCode from "./QRCode";
import { renderLogicalAssetAmount } from "./RenderLogicalAssetAmount";
import { Spinner } from "./Spinner";
import { StrategyPreferences } from "./StrategyPreferences";
import { ToggleSwitch } from "./ToggleSwitch";
import { allSupportedChainIds, getSupportedChainName } from "./chains";
import { isLikelyAnEnsName } from "./isLikelyAnEnsName";
import { isProduction } from "./isProduction";
import { LogicalAssetTicker, parseLogicalAssetAmount } from "./logicalAssets";
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
import { useLogicalAssetTickerSelectionInput } from "./useLogicalAssetTickerSelectionInput";
import { usePayWhatYouWantInput } from "./usePayWhatYouWantInput";

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

const recentlyUsedReceiversKey = "receivers";

async function seedRecentlyUsedReceiversExamples(): Promise<"examples-were-seeded" | undefined> { // a showcase feature to seed initial example recently used receivers
  const sentinelKey = "receiversExample";
  // await clearRecentlyUsed(sentinelKey); // development feature: uncomment this line to clear the sentinel value and reinitialize your local examples
  if ((await getMostRecentlyUsed(sentinelKey)).length < 1) {
    await addToRecentlyUsed(recentlyUsedReceiversKey, "example.eth");
    await addToRecentlyUsed(recentlyUsedReceiversKey, "barmstrong.cb.id");
    await addToRecentlyUsed(sentinelKey, "set"); // sentinel value to indicate that defaults were seeded and shouldn't be seeded again
    return "examples-were-seeded";
  } else return undefined;
}

const defaultSecondaryLogicalAssetTickers = new Set<LogicalAssetTicker>(['USD', 'ETH']);

export const RequestMoney: React.FC = () => {
  const { logicalAssetTicker: primaryLogicalAssetTicker, logicalAssetTickerSelectionInputElement } = useLogicalAssetTickerSelectionInput('USD');

  const [secondaryLogicalAssetTickers, setSecondaryLogicalAssetTickers] = useImmer<Set<LogicalAssetTicker>>(defaultSecondaryLogicalAssetTickers); // the set of secondary logical asset tickers also accepted for payment. WARNING may include primaryLogicalAssetTicker and must be removed before ProposedPayment construction. Default to USD and ETH because those are expected to be the most popular secondaries to accept

  const toggleSecondaryLogicalAssetTicker = useCallback((lat: LogicalAssetTicker) => {
    setSecondaryLogicalAssetTickers(draft => {
      if (draft.has(lat)) draft.delete(lat);
      else draft.add(lat);
    });
  }, [setSecondaryLogicalAssetTickers]);

  const [amount, setAmount] = useState<number | undefined>(undefined);

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

  useEffect(() => { // delete token strategy preferences when the primary or secondaries logical assets change because not doing so can lead to strategy preferences containing acceptedTokenTickers that are supported by a logical accept that is no longer accepted for payment, which creates longer pay links than necessary and may look like a bug to end-users see a token ticker for a currency that's not accepted. TODO an alternative this is to filter acceptedTokenTickers for only those supported by the logicalAssetTickers during CheckoutSettings construction --> consider doing this. That way, token strategy preferences wouldn't need to be redone when changing secondaries.
    setStrategyPreferences(draft => {
      if (draft) delete draft.acceptedTokenTickers;
    });
  }, [setStrategyPreferences, primaryLogicalAssetTicker, secondaryLogicalAssetTickers]);

  const [acceptedTokenTickersState, setAcceptedTokenTickersState] = useState<'denylist' | 'allowlist'>('denylist'); // WARNING normally, we can use strategyPreferences.acceptedTokenTickers.allowlist/denylist to determine if we're in allowlist or denylist mode. However, when building these lists, when toggling between allowlist to denylist mode, the default state for each list is to be empty, and when the list is empty we set acceptedTokenTickers to undefined (and disallow empty sets), and so we need a way to determine whether an undefined acceptedTokenTickers represents an empty allowlist or denylist. acceptedTokenTickersState determines that, and it must be properly kept in sync such that the invariant `acceptedTokenTickersState === 'denylist' && (acceptedTokenTickers === undefined || acceptedTokenTickers.denylist !== undefined)` holds, and vice-versa for 'allowlist'.

  const toggleBetweenAcceptedTokenTickersAllowlistAndDenylist = useCallback(() => {
    setStrategyPreferences(draft => {
      if (draft === undefined) {
        console.error("toggleBetweenAcceptedTokenTickersAllowlistAndDenylist: strategyPreferences unexpectedly undefined");
      } else if (draft.acceptedTokenTickers === undefined) switch (acceptedTokenTickersState) {
        case 'denylist': setAcceptedTokenTickersState('allowlist'); break;
        case 'allowlist': setAcceptedTokenTickersState('denylist'); break;
      } else if (draft.acceptedTokenTickers.denylist) {
        delete draft.acceptedTokenTickers;
        setAcceptedTokenTickersState('allowlist');
      } else {
        delete draft.acceptedTokenTickers;
        setAcceptedTokenTickersState('denylist');
      }
    });
  }, [setStrategyPreferences, acceptedTokenTickersState, setAcceptedTokenTickersState]);

  const [acceptedChainIdsState, setAcceptedChainIdsState] = useState<'denylist' | 'allowlist'>('denylist'); // WARNING normally, we can use strategyPreferences.acceptedChainIds.allowlist/denylist to determine if we're in allowlist or denylist mode. However, when building these lists, when toggling between allowlist to denylist mode, the default state for each list is to be empty, and when the list is empty we set acceptedChainIds to undefined (and disallow empty sets), and so we need a way to determine whether an undefined acceptedChainIds represents an empty allowlist or denylist. acceptedChainIdsState determines that, and it must be properly kept in sync such that the invariant `acceptedChainIdsState === 'denylist' && (acceptedChainIds === undefined || acceptedChainIds.denylist !== undefined)` holds, and vice-versa for 'allowlist'.

  const toggleBetweenAcceptedChainIdsAllowlistAndDenylist = useCallback(() => {
    setStrategyPreferences(draft => {
      if (draft === undefined) {
        console.error("toggleBetweenAcceptedChainIdsAllowlistAndDenylist: strategyPreferences unexpectedly undefined");
      } else if (draft.acceptedChainIds === undefined) switch (acceptedChainIdsState) {
        case 'denylist': setAcceptedChainIdsState('allowlist'); break;
        case 'allowlist': setAcceptedChainIdsState('denylist'); break;
      } else if (draft.acceptedChainIds.denylist) {
        delete draft.acceptedChainIds;
        setAcceptedChainIdsState('allowlist');
      } else {
        delete draft.acceptedChainIds;
        setAcceptedChainIdsState('denylist');
      }
    });
  }, [setStrategyPreferences, acceptedChainIdsState, setAcceptedChainIdsState]);

  const toggleTokenTickerForStrategyPreferences = useCallback((tt: Uppercase<string>) => {
    setStrategyPreferences(draft => {
      if (draft === undefined) {
        console.error("toggleTokenTickerForStrategyPreferences: strategyPreferences unexpectedly undefined");
      } else if (draft.acceptedTokenTickers === undefined) draft.acceptedTokenTickers = acceptedTokenTickersState === 'denylist' ? { denylist: new Set([tt]) } : { allowlist: new Set([tt]) };
      else if (draft.acceptedTokenTickers.denylist) {
        if (draft.acceptedTokenTickers.denylist.has(tt)) {
          draft.acceptedTokenTickers.denylist.delete(tt);
          if (draft.acceptedTokenTickers.denylist.size === 0) delete draft.acceptedTokenTickers;
        }
        else draft.acceptedTokenTickers.denylist.add(tt);
      } else if (draft.acceptedTokenTickers.allowlist) {
        if (draft.acceptedTokenTickers.allowlist.has(tt)) {
          draft.acceptedTokenTickers.allowlist.delete(tt);
          if (draft.acceptedTokenTickers.allowlist.size === 0) delete draft.acceptedTokenTickers;
        }
        else draft.acceptedTokenTickers.allowlist.add(tt);
      }
    });
  }, [setStrategyPreferences, acceptedTokenTickersState]);

  const toggleChainIdForStrategyPreferences = useCallback((cid: number) => {
    setStrategyPreferences(draft => {
      if (draft === undefined) {
        console.error("toggleChainIdForStrategyPreferences: strategyPreferences unexpectedly undefined");
      } else if (draft.acceptedChainIds === undefined) draft.acceptedChainIds = acceptedChainIdsState === 'denylist' ? { denylist: new Set([cid]) } : { allowlist: new Set([cid]) };
      else if (draft.acceptedChainIds.denylist) {
        if (draft.acceptedChainIds.denylist.has(cid)) {
          draft.acceptedChainIds.denylist.delete(cid);
          if (draft.acceptedChainIds.denylist.size === 0) delete draft.acceptedChainIds;
        } else draft.acceptedChainIds.denylist.add(cid);
      } else if (draft.acceptedChainIds.allowlist) {
        if (draft.acceptedChainIds.allowlist.has(cid)) {
          draft.acceptedChainIds.allowlist.delete(cid);
          if (draft.acceptedChainIds.allowlist.size === 0) delete draft.acceptedChainIds;
        } else draft.acceptedChainIds.allowlist.add(cid);
      }
    });
  }, [setStrategyPreferences, acceptedChainIdsState]);

  const toggleUseOfStrategyPreferences = useCallback((isOnAndNotUsingStrategyPrefs: boolean) => {
    if (isOnAndNotUsingStrategyPrefs) {
      setStrategyPreferences(undefined);
      setAcceptedTokenTickersState('denylist');
      setAcceptedChainIdsState('denylist');
    } else setStrategyPreferences({});
  }, [setStrategyPreferences, setAcceptedTokenTickersState]);

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
  const successRedirectCallToActionInputAttrs = useMemo<Parameters<typeof useInput>[1]>(() => ({
    name: "successRedirectCallToAction",
    type: "text",
    className: "w-full rounded-md border px-3.5 py-2 leading-6",
    placeholder: "Redirect call to action",
    autoComplete: "off",
  }), []);
  const [successRedirectCallToAction, successRedirectCallToActionInput, setSuccessRedirectCallToAction] = useInput("", successRedirectCallToActionInputAttrs, successRedirectUrlInputOpts);

  const webhookUrlInputAttrs = useMemo<Parameters<typeof useInput>[1]>(() => ({
    name: "webhookUrl",
    type: "text",
    className: "w-full rounded-md border px-3.5 py-2 leading-6",
    placeholder: "Webhook URL",
    autoComplete: "off",
  }), []);
  const webhookUrlInputOpts = useMemo<Parameters<typeof useInput>[2]>(() => ({ onEnterKeyPress: (e) => e.currentTarget.blur() }), []);
  const [webhookUrl, webhookUrlInput, setWebhookUrl] = useInput("", webhookUrlInputAttrs, webhookUrlInputOpts);

  useEffect(() => { // reset advanced options to defaults when advanced options are hidden. If we don't, then eg. user will turn advanced options off and send link, and not realize they sent an encrypted link because they had turned encryption before turning advanced options off
    if (!showAdvancedOptions) {
      setPrivacyAndSecurityMode('standard');
      setShowPassword(false);
      setPassword('');
      setSuccessRedirectOpenInNewTab(true);
      setSuccessRedirectUrl('');
      setSuccessRedirectCallToAction('');
      setWebhookUrl('');
    }
  }, [showAdvancedOptions, setPrivacyAndSecurityMode, setShowPassword, setPassword, setSuccessRedirectUrl, setSuccessRedirectCallToAction, setWebhookUrl]);

  const [paymentModeType, setPaymentModeType] = useState<'FixedAmount' | 'PayWhatYouWant'>('FixedAmount');

  const { payWhatYouWant, payWhatYouWantInputElement } = usePayWhatYouWantInput("PayWhatYouWant-input");

  const paymentMode = useMemo((): PaymentMode | undefined => {
    if (paymentModeType === 'FixedAmount' && amount && amount > 0) return { logicalAssetAmountAsBigNumberHexString: parseLogicalAssetAmount(amount.toString()).toHexString() };
    else if (paymentModeType === 'PayWhatYouWant') return {
      payWhatYouWant,
    }; else return undefined;
  }, [amount, paymentModeType, payWhatYouWant]);

  const checkoutSettings = useMemo<CheckoutSettings | undefined>(() => {
    if (
      paymentMode // can't build checkoutSettings without a payment mode
      && computedReceiver // can't build checkoutSettings without a receiver
      && (privacyAndSecurityMode === 'standard' || password.length > 0) // can't build checkoutSettings that requires a password if the password is empty
    ) {
      const logicalAssetTickers = new PrimaryWithSecondaries(primaryLogicalAssetTicker, Array.from(secondaryLogicalAssetTickers).filter(t => t !== primaryLogicalAssetTicker)); // WARNING here we must filter out primaryLogicalAssetTicker from secondaryLogicalAssetTickers as by our definition it may be included
      const proposedPayment: ProposedPayment = (() => {
        // The following curious block of code is needed because until the type guard isPaymentModeWithFixedAmount is executed, TypeScript can't infer that `paymentMode` is assignable to ProposedPayment.paymentMode:
        if (isPaymentModeWithFixedAmount(paymentMode)) return {
          logicalAssetTickers,
          paymentMode,
          receiver: computedReceiver,
        }; else return {
          logicalAssetTickers,
          paymentMode,
          receiver: computedReceiver,
        };
      })();
      return {
        proposedPayment,
        receiverStrategyPreferences: strategyPreferences || {},
        ...(note && { note: note.trim() }),
        senderNoteSettings: { mode: 'NONE' }, // TODO support senderNoteSettings
        ...(successRedirectUrl.length > 0 && {
          successRedirect: {
            url: successRedirectUrl,
            openInNewTab: successRedirectOpenInNewTab,
            ...(successRedirectCallToAction.trim().length > 0 && { callToAction: successRedirectCallToAction.trim() }),
          },
        }),
        ...(webhookUrl.length > 0 && { webhookUrl }),
      } satisfies CheckoutSettings;
    } else return undefined;
  }, [primaryLogicalAssetTicker, secondaryLogicalAssetTickers, computedReceiver, note, strategyPreferences, privacyAndSecurityMode, password, successRedirectUrl, successRedirectCallToAction, successRedirectOpenInNewTab, webhookUrl, paymentMode]);

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
    if (serializedCheckoutSettings && !serializedCheckoutSettingsIsLoading) return `${process.env['REACT_APP_DEVELOPMENT_INTRANET_IP'] ? `http://${process.env['REACT_APP_DEVELOPMENT_INTRANET_IP']}${location.port.length > 0 ? `:${location.port}` : ''}` : location.origin}/#/pay?${serializedCheckoutSettingsUrlParam}=${serializedCheckoutSettings}`; // REACT_APP_DEVELOPMENT_INTRANET_IP is a development feature. Set it in .env.local so that payment links generated on your laptop can be opened on your phone using the LAN
    else return undefined;
  }, [serializedCheckoutSettings, serializedCheckoutSettingsIsLoading]);

  const [showModalNonce, setShowModalNonce] = useState(0);
  const incrementShowModalNonce = useCallback(() => setShowModalNonce(n => n + 1), [setShowModalNonce]);
  useEffect(() => {
    setShowModalNonce(0); // NB we must reset showModalNonce when checkout changes, otherwise the modal will pop up without the user clicking request once checkout is redefined.
  }, [setShowModalNonce, checkoutSettings]);

  const { value: recentlyUsedReceivers, forceRecache: recacheRecentlyUsedReceivers } = useAsyncMemo(() => getMostRecentlyUsed<string>(recentlyUsedReceiversKey), [], []);

  useEffect(() => {
    let isMounted = true;
    seedRecentlyUsedReceiversExamples().then((r) => { if (isMounted && r === "examples-were-seeded") recacheRecentlyUsedReceivers(); });
    return () => { isMounted = false; };
  }, [recacheRecentlyUsedReceivers]);

  const renderedProposedPaymentFixedAmount: string | undefined = checkoutSettings && isProposedPaymentWithFixedAmount(checkoutSettings.proposedPayment) ? renderLogicalAssetAmount({
    logicalAssetTicker: checkoutSettings.proposedPayment.logicalAssetTickers.primary,
    amountAsBigNumberHexString: checkoutSettings.proposedPayment.paymentMode.logicalAssetAmountAsBigNumberHexString,
  }) : undefined;

  const checkoutTextToShare: string = (() => `Hey, can you please pay me${renderedProposedPaymentFixedAmount !== undefined ? ` ${renderedProposedPaymentFixedAmount}` : ''} using this link`)();

  const { disconnect } = useDisconnect();

  // TODO add a required warning that at least one token/chain are required if using allowlists and it's empty. Otherwise, the UI appears to say 'zero tokens allowed' but the generated link works and accepts all tokens (due to empty strategy prefs generated --> empty denylist)

  const [showAmountRequiredWarning, setShowAmountRequiredWarning] = useState(false); // if the user clicks Send Pay Link before filling in an amount, we'll show a warning that amount is a required field
  const [showReceiverRequiredWarning, setShowReceiverRequiredWarning] = useState(false); // if the user clicks Send Pay Link before filling in a receiver, we'll show a warning that receiver is a required field
  const [showPasswordRequiredWarning, setShowPasswordRequiredWarning] = useState(false); // if the user clicks Send Pay Link before filling in a password while privacyAndSecurityMode is encrypted or signed, we'll show a warning that password is a required field

  useEffect(() => { // typically, we don't reset any required warning until the send pay link button is clicked. This helps guide the user and reduce jank by not toggling warnings as they are still filling in fields. However, if the receiver required warning was set, but the user's wallet becomes connected, then the receiver is unconditionally and automatically set to the connected wallet address, and so the receiver required warning is now particularly redundant, so we unset it as a special case
    if (showReceiverRequiredWarning && isConnected && computedReceiver && computedReceiver.address && computedReceiver.address === connectedWalletAddress) {
      setShowReceiverRequiredWarning(false);
    }
  }, [isConnected, connectedWalletAddress, computedReceiver, showReceiverRequiredWarning, setShowReceiverRequiredWarning]);

  const onClickSendPayLink = useCallback(() => {
    if (checkoutSettings) { // NB some implicit control flow: here we check only that checkoutSettings is defined before showing the pay link share modal, but the modal depends on checkoutLink which may be undefined even if checkoutSettings is defined due to asynchronous generation of serializedCheckoutSettings. In this case, the modal will simply pop-up as soon as checkoutLink becomes available.
      setShowAmountRequiredWarning(false);
      setShowReceiverRequiredWarning(false);
      setShowPasswordRequiredWarning(false);
      incrementShowModalNonce();
      addToRecentlyUsed(recentlyUsedReceiversKey, checkoutSettings.proposedPayment.receiver.address || checkoutSettings.proposedPayment.receiver.ensName).then(recacheRecentlyUsedReceivers);
    } else {
      // NB here we set each warning flag to true if its required data are missing, but we never set them to false here because, as a UX design decision, we never clear warnings until the checkout link has been successfully generated (at which point we clear all warning flags, ie. in the if branch of this conditional)
      if (paymentModeType === 'FixedAmount' && !(amount && amount > 0)) setShowAmountRequiredWarning(true);
      if (!computedReceiver) setShowReceiverRequiredWarning(true);
      if (!(privacyAndSecurityMode === 'standard' || password.length > 0)) setShowPasswordRequiredWarning(true);
    }
  }, [incrementShowModalNonce, setShowAmountRequiredWarning, setShowReceiverRequiredWarning, setShowPasswordRequiredWarning, amount, paymentModeType, checkoutSettings, computedReceiver, recacheRecentlyUsedReceivers, privacyAndSecurityMode, password]);

  const { modal: privacyAndSecurityInfoModal, showModal: showPrivacyAndSecurityInfoModal } = useModal(<div className="w-full h-fit flex flex-col items-center justify-center gap-6">
    <span className="text-left w-full text-xl">Privacy & Security Options</span>
    <span className="text-left w-full text-lg"><span className="font-bold">Standard Security</span> - Pay Link details stored only in shared link.</span>
    <span className="text-left w-full text-lg"><span className="font-bold">Encrypted</span> - Like Standard Security, but details encrypted. Share password separately.</span>
    <span className="text-left w-full text-lg"><span className="font-bold">Anti-phishing</span> - Like Standard Security, not encrypted, but tamper-proof. Share password separately.</span>
  </div>);

  return <div className="mt-[3vh] w-full max-w-sm mx-auto flex flex-col items-center justify-center">
    <div className="w-full flex justify-start items-center gap-1">
      <span className="font-semibold">Amount</span>
      {showAmountRequiredWarning && <span className="text-red-600">(required)</span>}
    </div>
    <div className="w-full flex justify-between mt-2">
      <button
        type="button"
        disabled={paymentModeType === 'FixedAmount'}
        className="focus:outline-none rounded-md px-2 py-1 font-medium border border-primary enabled:active:scale-95 enabled:bg-white enabled:text-primary sm:enabled:hover:bg-primary sm:enabled:hover:text-white disabled:bg-primary disabled:text-white disabled:cursor-not-allowed"
        onClick={() => setPaymentModeType("FixedAmount")}
      >
        Receiver sets amount
      </button>
      <button
        type="button"
        disabled={paymentModeType === 'PayWhatYouWant'}
        className="focus:outline-none rounded-md px-2 py-1 font-medium border border-primary enabled:active:scale-95 enabled:bg-white enabled:text-primary sm:enabled:hover:bg-primary sm:enabled:hover:text-white disabled:bg-primary disabled:text-white disabled:cursor-not-allowed"
        onClick={() => setPaymentModeType("PayWhatYouWant")}
      >
        Sender sets amount
      </button>
    </div>
    {paymentModeType === 'FixedAmount' && <div className="w-full mt-2"><CurrencyAmountInput logicalAssetTicker={primaryLogicalAssetTicker} inputId="amount-input" setAmount={setAmount} /></div>}
    {paymentModeType === 'PayWhatYouWant' && <div className="w-full mt-4">{payWhatYouWantInputElement}</div>}
    <div className="w-full flex flex-wrap justify-between items-center gap-2 mt-4">
      <span className="w-full font-semibold">Currency</span>
      {logicalAssetTickerSelectionInputElement}
    </div>
    <div className="w-full flex justify-start items-center gap-1 mt-4">
      <span className="font-semibold">Receive at</span>
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
            {addressForDebouncedRawReceiverEnsName && <span className="text-gray-600">{truncateEthAddress(addressForDebouncedRawReceiverEnsName)}</span>}
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
    <div className="w-full flex justify-between items-center gap-2 mt-4">
      <span className="font-semibold">Accept with exchange rate</span>
      <div className="flex justify-end items-center gap-3">
        {(['USD', 'ETH'] satisfies LogicalAssetTicker[]).filter(t => t !== primaryLogicalAssetTicker).map(t => <div key={`${primaryLogicalAssetTicker}-${t}` /* WARNING here we use a key that changes when changing primaryLogicalAssetTicker. This is needed because today, ToggleSwitch doesn't support programmatic setting of its value, and so our only way to ensure these ToggleSwitches stay synced the fact that the primaryLogicalAssetTicker's ToggleSwitch may not be turned off (since it's the primary and not a valid secondary) is via initialIsOn, so we recreate these ToggleSwitches so they pick up their latest value of initialIsOn */} className="flex justify-center items-center gap-1">
          <span>{t}</span>
          <ToggleSwitch disabled={t === primaryLogicalAssetTicker} initialIsOn={t === primaryLogicalAssetTicker || secondaryLogicalAssetTickers.has(t)} onToggle={() => toggleSecondaryLogicalAssetTicker(t)} offClassName="text-gray-500" className="font-bold text-2xl" />
        </div>)}
      </div>
    </div>
    <div className="w-full flex flex-wrap justify-start items-center gap-2 mt-4">
      <span className="w-full font-semibold">Note</span>
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
      <span className="grow font-semibold">Default tokens and chains (recommended)</span>
      <ToggleSwitch initialIsOn={strategyPreferences === undefined} onToggle={toggleUseOfStrategyPreferences} offClassName="text-gray-500" className="font-bold text-2xl" />
    </div>
    {strategyPreferences !== undefined && <div className="w-full flex flex-col justify-between items-center gap-2 mt-2">
      <div className="w-full flex justify-between gap-4">
        <button
          type="button"
          disabled={(strategyPreferences.acceptedTokenTickers === undefined && acceptedTokenTickersState === 'denylist') || strategyPreferences.acceptedTokenTickers?.denylist !== undefined}
          className="focus:outline-none rounded-md px-2 py-1 font-medium border border-primary enabled:active:scale-95 enabled:bg-white enabled:text-primary sm:enabled:hover:bg-primary sm:enabled:hover:text-white disabled:bg-primary disabled:text-white disabled:cursor-not-allowed"
          onClick={toggleBetweenAcceptedTokenTickersAllowlistAndDenylist}
        >
          Token Denylist
        </button>
        <button
          type="button"
          disabled={(strategyPreferences.acceptedTokenTickers === undefined && acceptedTokenTickersState === 'allowlist') || strategyPreferences.acceptedTokenTickers?.allowlist !== undefined}
          className="focus:outline-none rounded-md px-2 py-1 font-medium border border-primary enabled:active:scale-95 enabled:bg-white enabled:text-primary sm:enabled:hover:bg-primary sm:enabled:hover:text-white disabled:bg-primary disabled:text-white disabled:cursor-not-allowed"
          onClick={toggleBetweenAcceptedTokenTickersAllowlistAndDenylist}
        >
          Token Allowlist
        </button>
      </div>
      <div className="w-full flex justify-between gap-4">
        <button
          type="button"
          disabled={(strategyPreferences.acceptedChainIds === undefined && acceptedChainIdsState === 'denylist') || strategyPreferences.acceptedChainIds?.denylist !== undefined}
          className="focus:outline-none rounded-md px-2 py-1 font-medium border border-primary enabled:active:scale-95 enabled:bg-white enabled:text-primary sm:enabled:hover:bg-primary sm:enabled:hover:text-white disabled:bg-primary disabled:text-white disabled:cursor-not-allowed"
          onClick={toggleBetweenAcceptedChainIdsAllowlistAndDenylist}
        >
          Chain Denylist
        </button>
        <button
          type="button"
          disabled={(strategyPreferences.acceptedChainIds === undefined && acceptedChainIdsState === 'allowlist') || strategyPreferences.acceptedChainIds?.allowlist !== undefined}
          className="focus:outline-none rounded-md px-2 py-1 font-medium border border-primary enabled:active:scale-95 enabled:bg-white enabled:text-primary sm:enabled:hover:bg-primary sm:enabled:hover:text-white disabled:bg-primary disabled:text-white disabled:cursor-not-allowed"
          onClick={toggleBetweenAcceptedChainIdsAllowlistAndDenylist}
        >
          Chain Allowlist
        </button>
      </div>
      <div className="grid grid-cols-8 w-full items-center gap-x-0">
        <span className="font-semibold text-left col-span-8 mt-1">Tokens</span>
        {allTokenTickers.filter(tt => isTokenTickerSupportedByLogicalAsset(primaryLogicalAssetTicker, tt) || Array.from(secondaryLogicalAssetTickers).some(lat => isTokenTickerSupportedByLogicalAsset(lat, tt))).flatMap((tt, i) => [
          <span key={`${tt}-${acceptedTokenTickersState}`} className={`${i % 2 === 0 ? ' col-span-2 text-left' : 'col-span-3 text-right'}`}>{tt}</span>,
          <ToggleSwitch
            key={`sw-${tt}-${acceptedTokenTickersState}` /* WARNING here we use a key that changes when toggling between allowlist and denylist, forcing recreation of ToggleSwitch. This is needed because today, ToggleSwitch doesn't support programmatic setting of its value, and so our only way to ensure ToggleSwitch stays synced with allowlist/denylist is via initialIsOn, so we recreate these ToggleSwitches so they pick up their latest value of initialIsOn */}
            className={`text-2xl ${i % 2 === 0 ? 'col-span-2 justify-start' : 'justify-end'}`}
            initialIsOn={Boolean(
              (strategyPreferences.acceptedTokenTickers === undefined && acceptedTokenTickersState === 'denylist')
              || strategyPreferences.acceptedTokenTickers?.denylist && !strategyPreferences.acceptedTokenTickers?.denylist.has(tt)
              || strategyPreferences.acceptedTokenTickers?.allowlist && strategyPreferences.acceptedTokenTickers?.allowlist.has(tt)
            ) /* here, a toggle being turned on represents the receiver accepting that token whether using allowlists or denylists. With denylist, all toggles default to on so as to have an empty denylist by default (at least to reduce serialization size and probably because it's better to let the user build their own list), whereas with allowlist, all toggles default to off so as to have an empty allowlist by default (at least to reduce serialization size and probably because it's better to let the user build their own list). */}
            onToggle={toggleTokenTickerForStrategyPreferences.bind(null, tt)}
          />,
        ])}
        <span className="font-semibold text-left col-span-8 mt-1">Chains</span>
        {allSupportedChainIds.flatMap((cid, i) => [
          <span key={`${cid}-${acceptedChainIdsState}`} className={`${i % 2 === 0 ? 'col-span-2 text-left' : 'col-span-3 text-right'}`}>{getSupportedChainName(cid)}</span>,
          <ToggleSwitch
            key={`sw-${cid}-${acceptedChainIdsState}` /* WARNING here we use a key that changes when toggling between allowlist and denylist, forcing recreation of ToggleSwitch. This is needed because today, ToggleSwitch doesn't support programmatic setting of its value, and so our only way to ensure ToggleSwitch stays synced with allowlist/denylist is via initialIsOn, so we recreate these ToggleSwitches so they pick up their latest value of initialIsOn */}
            className={`text-2xl ${i % 2 === 0 ? 'col-span-2 justify-start' : 'justify-end'}`}
            initialIsOn={Boolean(
              (strategyPreferences.acceptedChainIds === undefined && acceptedChainIdsState === 'denylist')
              || strategyPreferences.acceptedChainIds?.denylist && !strategyPreferences.acceptedChainIds?.denylist.has(cid)
              || strategyPreferences.acceptedChainIds?.allowlist && strategyPreferences.acceptedChainIds?.allowlist.has(cid)
            ) /* here, a toggle being turned on represents the receiver accepting that chain whether using allowlists or denylists. With denylist, all toggles default to on so as to have an empty denylist by default (at least to reduce serialization size and probably because it's better to let the user build their own list), whereas with allowlist, all toggles default to off so as to have an empty allowlist by default (at least to reduce serialization size and probably because it's better to let the user build their own list). */}
            onToggle={toggleChainIdForStrategyPreferences.bind(null, cid)}
          />,
        ])}
      </div>
    </div>}
    <div className="mt-4 w-full flex justify-between items-center">
      <span className="grow font-semibold">Basic settings</span>
      <ToggleSwitch initialIsOn={!showAdvancedOptions} onToggle={(v) => setShowAdvancedOptions(!v)} offClassName="text-gray-500" className="font-bold text-2xl" />
    </div>
    {showAdvancedOptions && <>
      <div className="w-full flex flex-wrap justify-between items-center gap-2 mt-4">
        <div className="flex justify-start items-center gap-1" onClick={showPrivacyAndSecurityInfoModal}>
          <span className="w-full font-semibold">Privacy &amp; Security</span>
          <FaInfoCircle className="text-lg sm:hover:text-gray-500 sm:hover:cursor-pointer" />
        </div>
        {privacyAndSecurityInfoModal}
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
        <span className="w-full font-semibold">Redirect after paying</span>
        {successRedirectUrlInput}
        {successRedirectCallToActionInput}
        <div className="w-full flex justify-start items-center gap-2">
          <span className="grow font-semibold">Redirect in new tab</span>
          <ToggleSwitch initialIsOn={successRedirectOpenInNewTab} onToggle={setSuccessRedirectOpenInNewTab} offClassName="text-gray-500" className="font-bold text-2xl" />
        </div>
      </div>
      <div className="w-full flex flex-wrap justify-between items-center gap-2 mt-4">
        <span className="w-full font-semibold">Webhook after paying</span>
        {webhookUrlInput}
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
      checkoutLink && <Modal showModalNonce={showModalNonce}>
        <SharePayLinkModalContent checkoutLink={checkoutLink} checkoutTextToShare={checkoutTextToShare} />
      </Modal>
    }
  </div >;
}

type SharePayLinkModalContentProps = {
  checkoutLink: string,
  checkoutTextToShare: string,
}

const SharePayLinkModalContent: React.FC<SharePayLinkModalContentProps> = ({ checkoutLink, checkoutTextToShare }) => {
  const [isCheckoutLinkCopied, setIsCheckoutLinkCopied] = useClipboard(checkoutLink || ' ', { // here we exclude checkoutTextToShare from the string copied to  clipboard because users seem to prefer that what's copied to the clipboard is the pure link vs the webshare API having the additional context provided by checkoutTextToShare
    successDuration: 2000,
  });

  const [isHtmlEmbedCopied, setIsHtmlEmbedCopied] = useClipboard(checkoutLink ? `<button style="color:#fff;background-color:#007bff;border-radius:5px;padding:10px 15px;border:none;cursor:pointer;" onclick="(function(){let m=document.createElement('div');m.style='position:fixed;top:0;left:0;width:100%;height:100%;background-color:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';m.onclick=function(e){if(e.target===m){removeModal();}};let removeModal=function(){if(document.body.contains(m)){document.body.removeChild(m);document.removeEventListener('keydown',escListener);}};let escListener=function(e){if(e.key==='Escape'){removeModal();}};document.addEventListener('keydown',escListener);let mc=document.createElement('div');let maxWidth = window.innerWidth < 420 ? (window.innerWidth - 30) + 'px' : '390px';mc.style='background-color:#f1f1f1;padding:8px;width:100%;max-width:' + maxWidth + ';height:95vh;max-height:1024px;border-radius:10px;position:relative;box-shadow:0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06);margin:auto;';let i=document.createElement('iframe');i.style='width:100%;height:100%;border:0;';i.src='${checkoutLink}';let c=document.createElement('div');c.style='position:absolute;top:5px;right:5px;width:24px;height:24px;cursor:pointer;z-index:10;';c.innerHTML='<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 20 20\\' fill=\\'currentColor\\' style=\\'width:100%;height:100%;\\'><path fill-rule=\\'evenodd\\' clip-rule=\\'evenodd\\' d=\\'M10 9.293l5.146-5.147a.5.5 0 01.708.708L10.707 10l5.147 5.146a.5.5 0 01-.708.708L10 10.707l-5.146 5.147a.5.5 0 01-.708-.708L9.293 10 4.146 4.854a.5.5 0 11.708-.708L10 9.293z\\'></path></svg>';c.onclick=function(){removeModal();};mc.appendChild(i);mc.appendChild(c);m.appendChild(mc);document.body.appendChild(m);})();">Pay</button>` : ' ', {
    successDuration: 4000,
  });

  const [isReactEmbedCopied, setIsReactEmbedCopied] = useClipboard(checkoutLink ? `<span dangerouslySetInnerHTML={{ __html: \`<button style="color:#fff;background-color:#007bff;border-radius:5px;padding:10px 15px;border:none;cursor:pointer;" onClick="(function(){let m=document.createElement('div');m.style='position:fixed;top:0;left:0;width:100%;height:100%;background-color:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';m.onclick=function(e){if(e.target===m){removeModal();}};let removeModal=function(){if(document.body.contains(m)){document.body.removeChild(m);document.removeEventListener('keydown',escListener);}};let escListener=function(e){if(e.key==='Escape'){removeModal();}};document.addEventListener('keydown',escListener);let mc=document.createElement('div');let maxWidth = window.innerWidth < 440 ? (window.innerWidth - 50) + 'px' : '390px';mc.style='background-color:#f1f1f1;padding:8px;width:100%;max-width:' + maxWidth + ';height:95vh;max-height:1024px;border-radius:10px;position:relative;box-shadow:0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06);margin:auto;';let i=document.createElement('iframe');i.style='width:100%;height:100%;border:0;';i.src='${checkoutLink}';let c=document.createElement('div');c.style='position:absolute;top:5px;right:5px;width:24px;height:24px;cursor:pointer;z-index:10;';c.innerHTML='<svg xmlns=\\\\'http://www.w3.org/2000/svg\\\\' viewBox=\\\\'0 0 20 20\\\\' fill=\\\\'currentColor\\\\' style=\\\\'width:100%;height:100%;\\\\'><path fill-rule=\\\\'evenodd\\\\' clip-rule=\\\\'evenodd\\\\' d=\\\\'M10 9.293l5.146-5.147a.5.5 0 01.708.708L10.707 10l5.147 5.146a.5.5 0 01-.708.708L10 10.707l-5.146 5.147a.5.5 0 01-.708-.708L9.293 10 4.146 4.854a.5.5 0 11.708-.708L10 9.293z\\\\'></path></svg>';c.onclick=function(){removeModal();};mc.appendChild(i);mc.appendChild(c);m.appendChild(mc);document.body.appendChild(m);})();">Pay</button>\` }}></span>` : ' ', {
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
