import { type ExchangeRates, type LogicalAssetTicker, convert, defaultSmallAmountsPerLogicalAsset, getChain, getLogicalAssetTickerForTokenOrNativeCurrencyTicker, getSupportedChainName, getTokenKey, isNativeCurrency, parseLogicalAssetAmount } from "@3cities/core";
import { getETHTransferProxyContractAddress } from "@3cities/eth-transfer-proxy";
import React, { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { FaEye } from "react-icons/fa";
import { Link } from "react-router-dom";
import useClipboard from "react-use-clipboard";
import { toast } from "sonner";
import { serialize, useAccount } from "wagmi";
import { getBlockExplorerUrlForAddress, getBlockExplorerUrlForTransaction } from "./blockExplorerUrls";
import { type CheckoutSettings } from "./CheckoutSettings";
import { type CheckoutSettingsRequiresPassword, isCheckoutSettingsRequiresPassword } from "./CheckoutSettingsContext";
import { ConnectWalletButton } from "./ConnectWalletButton";
import { CurrencyAmountInput } from "./CurrencyAmountInput";
import { ExternalLink } from "./ExternalLink";
import { type IframeMessage, closeIframe, isRunningInAStandaloneWindow, isRunningInAnIframe, notifyParentWindowOfSuccessfulCheckout, notifyParentWindowOfTransactionSigned } from "./iframe";
import { type Payment, type PaymentWithFixedAmount, type ProposedPaymentWithFixedAmount, type ProposedPaymentWithReceiverAddress, acceptProposedPayment, isPaymentWithFixedAmount, isProposedPaymentWithFixedAmount } from "./Payment";
import { PrimaryWithSecondaries } from "./PrimaryWithSecondaries";
import QRCode from "./QRCode";
import { RenderLogicalAssetAmount, renderLogicalAssetAmount } from "./RenderLogicalAssetAmount";
import { RenderTokenBalance } from "./RenderTokenBalance";
import { RenderTokenTransfer } from "./RenderTokenTransfer";
import { type ProposedStrategy, type Strategy, getProposedStrategiesForProposedPayment, getStrategiesForPayment } from "./strategies";
import { ToggleSwitch } from "./ToggleSwitch";
import { type TokenTransfer } from "./tokenTransfer";
import { ExecuteTokenTransferButton, type ExecuteTokenTransferButtonProps, type ExecuteTokenTransferButtonStatus, TransactionFeeUnaffordableError } from "./transactions";
import { truncateEnsName, truncateEthAddress } from "./truncateAddress";
import { useActiveDemoAccount } from "./useActiveDemoAccount";
import { useBestStrategy } from "./useBestStrategy";
import { useCaip222StyleSignature } from "./useCaip222StyleSignature";
import { useCheckoutSettings } from "./useCheckoutSettings";
import { useConnectedAccountContext } from "./useConnectedAccountContext";
import useDebounce from "./useDebounce";
import { useExchangeRates } from "./useExchangeRates";
import { useInput } from "./useInput";
import { useLogicalAssetTickerSelectionInput } from "./useLogicalAssetTickerSelectionInput";
import { useProposedPaymentReceiverAddressAndEnsName } from "./useProposedPaymentReceiverAddressAndEnsName";
import { applyVariableSubstitutions } from "./variableSubstitutions";

// TODO go through all the todos/notes here and consolidate a spec/design doc for smart contract wallet detection + eip1271 signature verification. Here are some interesting snippets:
// connectedAddressType: loading | unknown / error | definitelySmartContractWallet | likelyEoa
// --> const connectedAddressType = useAddressType(connectedAdress); --> perhaps look at useEnsAddress API for inspiration
// TODO iff CheckoutSettings option set, upon user signing message to verify their wallet, then iff 3cities detects wallet as a smart contract, 3cities will verify that the signature is eip1271 compliant by making an isValidSignature call to the smart contract wallet. NB if the smart contract wallet is counterfactual, it'll appear to be an EOA, then verification will be skipped, then the verifier will later detect it as a smart contract wallet and verify eip1271 signature
// NB when doing smart contract wallet detection, search all supported chains to see if any non-zero-code-size instance can be found, as this helps avoid the case where we think an address is an eoa but it's a counterfactually instantiated wallet --> actually, don't do this, just check the chain on which the selected payment method exists? --> searching all chains in parallel for smart contract wallet detection seems like a good thing to punt on and add support later
// TODO add smart contract wallet protection --> eg. useDoesReceiveAddressSeemSafe(receiverAddress): undefined | { seemsSafe: true, unsafeReason: undefined } | { seemsSafe: false, unsafeReason: 'receiverAddressIsATokenContract', token: Token } | { seemsSafe: false, unsafeReason: 'receiverAddressIsASmartContract', confirmedAcceptedChainIds: [ /* chainIds for which a contract with this address has the same bytecode on the addresses it was detected... ? need to confirm this algorithm with an expert eg. obront */ ] }

// TODO per chain receive address, and/or an explicit default address for all chains, and allow using 3cities default allowlist of tokens/chains only if the explicit default address is set... otherwise chains are allowlist of those for which a per chain receive address has been specified.

// TODO support isDynamicPricingEnabled --> eg. add derivedSuggestedPaymentAmounts which calculates suggested amounts when ac finishes loading, and never recalculates them unless page reloads to avoid suggested amount UI jank

// TODO add a big "continue" button at bottom of "select payment method" because if you don't want to change the method, it's unclear that you have to click on the current method. --> see the "continue" button at bottom of Amazon's payment method selection during mobile checkout.

export const Pay: React.FC = () => {
  const cs: CheckoutSettings | CheckoutSettingsRequiresPassword = useCheckoutSettings();
  if (isCheckoutSettingsRequiresPassword(cs)) return <PayNeedsPassword csrp={cs} />;
  else return <PayInner checkoutSettings={cs} />;
}

type PayNeedsPasswordProps = {
  csrp: CheckoutSettingsRequiresPassword;
}

const PayNeedsPassword: React.FC<PayNeedsPasswordProps> = ({ csrp }) => {
  const [isPasswordIncorrect, setIsPasswordIncorrect] = useState<boolean | 'loading'>(false);

  const rawSetPassword = csrp.setPassword; // local var so hook can depend only on csrp.setPassword
  const setPassword = useCallback((password: string) => {
    setIsPasswordIncorrect('loading');
    rawSetPassword(password);
  }, [rawSetPassword]);

  useEffect(() => { // after the user submits the password, we'll allow a short duration for upstream to process the checkout settings and redirect away from this password submission page, after which we'll assume the password as incorrect and show an error
    let timerId: NodeJS.Timeout | undefined = undefined;
    if (isPasswordIncorrect === 'loading') {
      timerId = setTimeout(() => setIsPasswordIncorrect(true), 500);
    }
    return () => clearTimeout(timerId);
  });

  const [showPassword, setShowPassword] = useState(false);

  const [password, passwordInput] = useInput("", {
    name: "password",
    type: showPassword ? "text" : "password",
    className: "w-full rounded-md border px-3.5 py-2 leading-6",
    placeholder: "Password",
    autoComplete: "off",
  }, {
    onEnterKeyPress() { setPassword(password) },
  });

  return (
    <div className="flex flex-col justify-center w-full py-6 gap-4">
      <h1 className="text-xl">{(() => {
        switch (csrp.requirementType) {
          case 'needToDecrypt': return 'Pay Link is encrypted';
          case 'needToVerifySignature': return 'Pay Link anti-phishing enabled';
        }
      })()}</h1>
      {passwordInput}
      {isPasswordIncorrect === true && <div className="text-red-600">Wrong password</div>}
      <div className="w-full flex justify-start items-center gap-2">
        <span>Show password</span>
        <ToggleSwitch initialIsOn={showPassword} onToggle={setShowPassword} offClassName="text-gray-500" className="font-bold text-2xl" />
      </div>
      <button
        type="button"
        className="rounded-md p-3.5 font-medium bg-primary text-white sm:hover:bg-primary-darker sm:hover:cursor-pointer w-full"
        onClick={() => setPassword(password)}
      >
        Submit
      </button>
    </div>
  );
};

const BestStrategyLabel: React.FC = () => <span></span>; // actual: `<span className="text-primary-darker font-semibold">best</span>` --> NB I like the BestStrategyLabel system, I think it's user-centric and helps explain how 3cities works. However, I think there's a real possibility of it angering many L2 tribes in terms of describing their payment methods as "non-best". TODO can we  find another succinct label here, like "cheapest" or "recommended"?

type PayInnerProps = {
  checkoutSettings: CheckoutSettings;
}

const PayInner: React.FC<PayInnerProps> = ({ checkoutSettings }) => {
  const startTransition = useTransition()[1];

  const checkoutVerbLowercase: Lowercase<string> = checkoutSettings.mode === "deposit" ? "deposit" : "pay";
  const checkoutVerbCapitalized: Capitalize<string> = checkoutSettings.mode === "deposit" ? "Deposit" : "Pay";
  const checkoutNounLowercase: Lowercase<string> = checkoutSettings.mode === "deposit" ? "deposit" : "payment";
  const checkoutNounCapitalized: Capitalize<string> = checkoutSettings.mode === "deposit" ? "Deposit" : "Payment";

  const { isConnected, address: connectedAddress } = useAccount();

  const proposedPaymentWithFixedAmount: ProposedPaymentWithFixedAmount | undefined = (() => { // NB no useMemo is needed here because we are copying checkoutSettings.proposedPayment into proposedPaymentWithFixedAmount and this object reference is stable across renders because checkoutSettings is stable across renders
    if (isProposedPaymentWithFixedAmount(checkoutSettings.proposedPayment)) return checkoutSettings.proposedPayment;
    else return undefined;
  })();

  const { receiverAddress, receiverEnsName, receiverAddressIsLoading } = useProposedPaymentReceiverAddressAndEnsName(checkoutSettings.proposedPayment);

  const ac = useConnectedAccountContext();

  const [isDuringConnectedAccountContextInitialLoadGracePeriod, setIsDuringConnectedAccountContextInitialLoadGracePeriod] = useState(true); // isDuringConnectedAccountContextInitialLoadGracePeriod enables us to differentiate between the case where no payment methods are found because the connected account context is still loading and there's not yet sufficent data vs the account context (likely) finished loading and there are no payment methods
  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined = undefined;
    if (connectedAddress) {
      setIsDuringConnectedAccountContextInitialLoadGracePeriod(true);
      timerId = setTimeout(() => setIsDuringConnectedAccountContextInitialLoadGracePeriod(false), 500); // if this timeout is too short, then this grace period feature doesn't fulfill its intended function of preventing "no payment methods" from flashing on the screen when the sender has payment methods but they are still initially loading. If this timeout is too long, then the screen will appear to hang with "pay now - loading" before resolving to "no payment methods" when the sender has no payment methods
    } else setIsDuringConnectedAccountContextInitialLoadGracePeriod(false);
    return () => clearTimeout(timerId);
  }, [setIsDuringConnectedAccountContextInitialLoadGracePeriod, connectedAddress]);

  const [payWhatYouWantSelectedSuggestedAmount, setPayWhatYouWantSelectedSuggestedAmount] = useState<bigint | 'other' | undefined>(undefined); // fixed payment amount chosen by sender from suggested amounts in PayWhatYouWant mode. Denominated in logical asset decimals

  const [rawPayWhatYouWantAmountFromInput, setRawPayWhatYouWantAmountFromInput] = useState<number | undefined>(undefined); // fixed payment amount specified by sender in PayWhatYouWant mode. Denominated in canonical units (eg. $1 = 1.0) and not in logical asset decimals
  const payWhatYouWantAmountFromInput: number | undefined = useDebounce(rawPayWhatYouWantAmountFromInput, 250, rawPayWhatYouWantAmountFromInput === undefined); // debounce amount to avoid regenerating strategies as user is typing. Flush debounce iff new amount undefined so the UI feels snappier when clearing amount

  const { logicalAssetTicker: payWhatYouWantLogicalAssetTickerFromInput, logicalAssetTickerSelectionInputElement: payWhatYouWantLogicalAssetTickerSelectionInputElement } = useLogicalAssetTickerSelectionInput(checkoutSettings.proposedPayment.logicalAssetTickers.primary); // logical asset ticker specified by sender in PayWhatYouWantMode

  const derivedPaymentWithFixedAmount = useMemo<PaymentWithFixedAmount | undefined>(() => { // the final computed payment that the sender will actually send up settling. WARNING derivedPaymentWithFixedAmount may contain payment details different than the passed CheckoutSettings.proposedPayment, eg. due to sender picking a new amount in PayWhatYouWant mode, or for other reasons
    const proposedPaymentWithReceiverAddress: ProposedPaymentWithReceiverAddress | undefined = receiverAddress === undefined ? undefined : Object.assign({}, checkoutSettings.proposedPayment, {
      receiver: { address: receiverAddress },
    });

    const payment: Payment | undefined = proposedPaymentWithReceiverAddress && ac && acceptProposedPayment(ac.address, proposedPaymentWithReceiverAddress);

    const payWhatYouWantAmount: bigint | undefined = (() => { // final amount specified by sender in PayWhatYouWant mode. Denominated in logical asset decimals
      // there are two ways for the sender to specify payWhatYouWantAmount: by typing in an amount or selecting a suggested amount:
      if ((payWhatYouWantSelectedSuggestedAmount === undefined || payWhatYouWantSelectedSuggestedAmount === 'other') && payWhatYouWantAmountFromInput !== undefined) return parseLogicalAssetAmount(payWhatYouWantAmountFromInput.toString()); // here we prioritize payWhatYouWantAmountFromInput as it's defined only if amount input is displayed and user has typed into it, which happens if we're in pay what you want mode AND (there's no suggested amounts OR there are suggested amounts and user picked 'other' to type in amount) --> WARNING must explicitly check for either no suggested amounts or suggested amount set to "other", otherwise a previously typed "other" amount will be used after the user selects a suggested amount because `payWhatYouWantAmountFromInput` is not set back to undefined after deselecting "other"
      else if (payWhatYouWantSelectedSuggestedAmount !== undefined && payWhatYouWantSelectedSuggestedAmount !== 'other') return payWhatYouWantSelectedSuggestedAmount; // NB payWhatYouWantSelectedSuggestedAmount is already denominated in logical asset decimals
      else return undefined;
    })();

    const payWhatYouWantLogicalAssetTicker = payWhatYouWantSelectedSuggestedAmount === 'other' || payWhatYouWantSelectedSuggestedAmount === undefined ? payWhatYouWantLogicalAssetTickerFromInput : checkoutSettings.proposedPayment.logicalAssetTickers.primary; // the final derived logical asset ticker in which the sender's payment will be denominated

    if (payment && isPaymentWithFixedAmount(payment)) return payment;
    else if (payment && payWhatYouWantAmount !== undefined && payWhatYouWantAmount > 0) {
      const derivedPayment: PaymentWithFixedAmount = {
        ...payment,
        logicalAssetTickers: new PrimaryWithSecondaries(payWhatYouWantLogicalAssetTicker, ((): readonly LogicalAssetTicker[] => {
          if (payWhatYouWantLogicalAssetTicker === checkoutSettings.proposedPayment.logicalAssetTickers.primary) return checkoutSettings.proposedPayment.logicalAssetTickers.secondaries; // sender has not changed the payment's logical asset ticker from the original, so we'll simply copy the original secondaries into the derived payment
          else { // sender changed the payment's logical asset ticker from the original, so we'll compute new secondaries
            const s = new Set(checkoutSettings.proposedPayment.logicalAssetTickers.secondaries);
            s.add(checkoutSettings.proposedPayment.logicalAssetTickers.primary); // as an opinionated simplification, we'll add the original primary to the derived secondaries. This lets the sender settle payment in the original primary, which is convenient for both the sender (who benefits from greater variety of payment methods) and receiver (who picked the original primary as the default)
            s.delete(payWhatYouWantLogicalAssetTicker); // we must remove the new primary from secondaries as a primary may not appear in the secondaries
            return Array.from(s);
          }
        })()),
        paymentMode: {
          logicalAssetAmount: payWhatYouWantAmount,
        },
      };
      return derivedPayment;
    } else return undefined;
  }, [checkoutSettings.proposedPayment, receiverAddress, ac, payWhatYouWantSelectedSuggestedAmount, payWhatYouWantAmountFromInput, payWhatYouWantLogicalAssetTickerFromInput]);

  const [status, setStatusRaw] = useState<ExecuteTokenTransferButtonStatus | undefined>(undefined);
  const setStatus = useMemo((): (s: ExecuteTokenTransferButtonStatus | undefined) => void => { // here we construct a synthetic setStatus that never overwrites a previously successful status. This is because the Pay component is designed to complete at most one checkout, but upon checkout completion, the underlying ExecuteTokenTransferButton will be unmounted, which causes it to push a final undefined status, and this final undefined status will overwrite our success status if we let it
    return (s: ExecuteTokenTransferButtonStatus | undefined) => setStatusRaw(prevStatus => prevStatus?.isSuccess ? prevStatus : s);
  }, [setStatusRaw]);
  // @eslint-no-use-below[setStatusRaw] -- setStatusRaw intended only to be a dependency of setStatus

  const statusIsError = status?.isError === true; // local var for use as a hook dependency to prevent unnecessary rerenders when this bool goes from undefined to false
  const statusIsSuccess = status?.isSuccess === true; // local var for use as a hook dependency to prevent unnecessary rerenders when this bool goes from undefined to false

  useEffect(() => { // handle checkoutSettings.successAction.closeWindow.ifIframe.autoClose
    if (isRunningInAnIframe && statusIsSuccess && checkoutSettings.successAction?.closeWindow?.ifIframe.autoClose !== undefined) {
      const timerId = setTimeout(() => {
        closeIframe(checkoutSettings.iframeParentWindowOrigin);
      }, checkoutSettings.successAction.closeWindow.ifIframe.autoClose.delayMilliseconds || 4000);
      return () => clearTimeout(timerId);
    } else return undefined;
  }, [checkoutSettings.successAction?.closeWindow?.ifIframe.autoClose, checkoutSettings.iframeParentWindowOrigin, statusIsSuccess]);

  useEffect(() => { // call webhook on success iff checkoutSettings has a webhook
    if (statusIsSuccess && checkoutSettings.webhookUrl
      && status?.activeTokenTransfer?.token.chainId // TODO chainId should be defined unconditionally once we source it from status.successData.tokenTransfer.token.chainId, and then this condition can be removed
    ) {
      fetch(checkoutSettings.webhookUrl, { // TODO support pass-through url params where arbitrary url params on the pay link are auto-forwarded to the webhook url
        method: 'POST',
        mode: 'no-cors', // here we use no-cors to obviate any CORS policy concerns, at the cost of being unable to access the webhook response, which we discard anyway
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'success', // TODO call webhookUrl for more checkout lifecycle events
          // TODO status.successData should be a product type that includes the token transfer for the successful transfer, the transaction receipt, and perhaps other data. status.successData.tokenTransfer should be used here instead of activeTokenTransfer
          chainId: status.activeTokenTransfer.token.chainId,
          transactionHash: status.successData.transactionHash,
          senderAddress: status.successData.from,
          currency: getLogicalAssetTickerForTokenOrNativeCurrencyTicker(status.activeTokenTransfer.token.ticker),
          amount: status.activeTokenTransfer.amount.toString(), // WARNING bigint can't be serialized with JSON.stringify
          tokenContractAddress: status.activeTokenTransfer.token.contractAddress || 'native',
          // TODO sender/buyer note
          // TODO the pay link itself?
          // TODO block explorer url and/or 3cities in-app receipt url
          // TODO if this pay link uses modal embed, we can use iframe message passing to let 3cities know the url of the host page, and include it here
          // TODO checkoutSettings.reference
        }),
      })/*.then(data => console.info("success webhook response", data))*/ // NB due to no-cors mode the response is opaque and we can't access any response data, including response status
        .catch(e => console.error("success webhook error", e));
    }
  }, [checkoutSettings.webhookUrl, statusIsSuccess, status?.successData, status?.activeTokenTransfer]);

  const exchangeRates: ExchangeRates | undefined = useExchangeRates(checkoutSettings.exchangeRates);

  const isStrategyPermittedByCheckoutSettings = useCallback<(s: Strategy | ProposedStrategy) => boolean>((s: Strategy | ProposedStrategy) => { // after strategies are generated, strategies (or proposed strategies) must be filtered through isStrategyPermittedByCheckoutSettings to prevent presenting the user with any strategies that are known to be disallowed by CheckoutSettings for reasons that were not detectable during strategy generation. NB the design tension here between StrategyPreferences, which are data used in strategy generation, vs. the subset of CheckoutSettings that are not used in strategy generation but do deterministically constrict the set of available strategies. Perhaps in the future, these CheckoutSettings data that constrict strategies should instead be passed to generation. Or perhaps the way it is now is more correct, where there are some data that are only indirectly related to strategies but act to constrict strategies (such as nativeTokenTransferProxy).
    const token = ('tokenTransfer' in s ? s.tokenTransfer : s.proposedTokenTransfer).token;
    if (isNativeCurrency(token) && checkoutSettings.nativeTokenTransferProxy === 'require' && !getETHTransferProxyContractAddress(token.chainId)) return false;
    else return true;
  }, [checkoutSettings.nativeTokenTransferProxy]);

  const proposedStrategies = useMemo<ProposedStrategy[]>(() => { // WARNING proposedStrategies are computed without considering any connected wallet, and may contain synthetic (non-real) payment amounts for illustrative purposes
    const p = ((): ProposedPaymentWithFixedAmount => {
      const csp = checkoutSettings.proposedPayment;
      if (isProposedPaymentWithFixedAmount(csp)) return csp;
      else return {
        ...csp,
        paymentMode: {
          logicalAssetAmount: csp.paymentMode.payWhatYouWant.suggestedLogicalAssetAmounts[0] || defaultSmallAmountsPerLogicalAsset[csp.logicalAssetTickers.primary], // WARNING here we fall back to synthetic (non-real, arbitrary) payment amounts for illustrative purposes
        },
      };
    })();
    return getProposedStrategiesForProposedPayment(exchangeRates, checkoutSettings.receiverStrategyPreferences, p).filter(isStrategyPermittedByCheckoutSettings);
  }, [checkoutSettings.receiverStrategyPreferences, checkoutSettings.proposedPayment, exchangeRates, isStrategyPermittedByCheckoutSettings]);

  const strategies = useMemo<Strategy[] | undefined>(() => {
    if (derivedPaymentWithFixedAmount && ac) return getStrategiesForPayment(exchangeRates, checkoutSettings.receiverStrategyPreferences, derivedPaymentWithFixedAmount, ac).filter(isStrategyPermittedByCheckoutSettings);
    else return undefined;
  }, [checkoutSettings.receiverStrategyPreferences, derivedPaymentWithFixedAmount, ac, exchangeRates, isStrategyPermittedByCheckoutSettings]);

  const { bestStrategy, otherStrategies, disableAllStrategiesOriginatingFromChainId, selectStrategy } = useBestStrategy(strategies);

  const { signature: caip222StyleSignature, message: caip222StyleMessageThatWasSigned, sign: caip222StyleExecuteSign, signRejected: caip222StyleSignRejected, signCalledAtLeastOnce: caip222StyleSignCalledAtLeastOnce, isError: caip222StyleSignatureIsError, error: caip222StyleSignatureError, isLoading: caip222StyleSignatureIsLoading, loadingStatus: caip222StyleSignatureLoadingStatus, reset: caip222StyleReset } = useCaip222StyleSignature({
    enabled: checkoutSettings.authenticateSenderAddress !== undefined,
    eip1271ChainId: bestStrategy?.tokenTransfer.token.chainId,
  });

  const sr = status?.reset; // local var to have this useCallback depend only on status.reset
  const doReset = useCallback(() => {
    caip222StyleReset();
    if (sr) sr();
  }, [caip222StyleReset, sr]);
  // @eslint-no-use-below[sr]

  const errMsgToCopyAnonymized: string = (() => {
    let errString = ' ';
    if (caip222StyleSignatureIsError) errString = `${caip222StyleSignatureError} ${serialize(caip222StyleSignatureError.cause)}`;
    else if (status?.isError) errString = `${status.error} ${serialize(status.error)}`
    return sanitize(errString);

    function sanitize(s: string): string {
      const s2 = s.replace(checkoutSettings.proposedPayment.receiver.address ? new RegExp(checkoutSettings.proposedPayment.receiver.address, 'gi') : new RegExp(checkoutSettings.proposedPayment.receiver.ensName, 'gi'), `<redacted receiver ${checkoutSettings.proposedPayment.receiver.address ? 'address' : 'ens name'}>`)
      const s3 = connectedAddress === undefined ? s2 : s2.replace(new RegExp(connectedAddress, 'gi'), '<redacted connected wallet address>');
      return s3;
    }
  })();

  const [isErrorCopied, setCopied] = useClipboard(errMsgToCopyAnonymized, {
    successDuration: 10000, // `isErrorCopied` will go back to `false` after 10000ms
  });

  const isAnyError: boolean = statusIsError || caip222StyleSignatureError !== undefined;

  // TODO find a long-term solution instead of this retry button. Or maybe the long-term solution is a more polished retry button?
  const retryButton = useMemo(() => isAnyError ? <div className="grid grid-cols-1 w-full gap-4">
    <div className="mt-4 grid grid-cols-2 w-full gap-4">
      <button className="bg-primary sm:hover:bg-primary-darker sm:hover:cursor-pointer text-white font-bold py-2 px-4 rounded" onClick={doReset}>Retry</button>
      <button className="bg-primary sm:enabled:hover:bg-primary-darker sm:enabled:hover:cursor-pointer text-white font-bold py-2 px-4 rounded" disabled={isErrorCopied} onClick={setCopied}>{isErrorCopied ? 'Copied. DM to @3cities_xyz' : 'Copy Error'}</button>
    </div>
    <span className="text-sm text-center">Please <span className="font-bold text-primary sm:hover:cursor-pointer sm:hover:text-primary-darker" onClick={setCopied}>copy error</span> and<br />paste in a DM to <ExternalLink href="https://twitter.com/3cities_xyz">@3cities_xyz</ExternalLink></span>
  </div> : undefined, [doReset, isErrorCopied, setCopied, isAnyError]);

  const receiverAddressBlockExplorerLink = useMemo<string | undefined>(() => {
    if (receiverAddress) {
      return getBlockExplorerUrlForAddress((status?.activeTokenTransfer || bestStrategy?.tokenTransfer || proposedStrategies[0]?.proposedTokenTransfer)?.token.chainId, receiverAddress); // the idea here is we'll show an explorer link for the chain that's most relevant to the payment
    }
    else return undefined;
  }, [receiverAddress, status?.activeTokenTransfer, proposedStrategies, bestStrategy?.tokenTransfer]);

  const [showFullReceiverAddress, setShowFullReceiverAddress] = useState(false);

  const [nextStrategyWasSelectedByTheUser, setNextStrategyWasSelectedByTheUser] = useState(false); // true iff the next `bestStrategy` was selected manually by the user. Ie. set to true only if selectStrategy has been called due to user selecting a new payment method. Used to prevent a jarring UX where if user selects a new payment method and that payment method is immediately determined to be unaffordable, we want to show feedback to the user.
  const [userSelectedCurrentStrategy, setUserSelectedCurrentStrategy] = useState(false); // true iff the current `bestStrategy` was selected manually by the user from the list of payment methods. Used to prevent a jarring UX where if user selects a new payment method and that payment method is immediately determined to be unaffordable, we want to show feedback to the user.
  const [feeUnaffordableToastDisplayedForCurrentStrategy, setFeeUnaffordableToastDisplayedForCurrentStrategy] = useState(false); // used to prevent showing a double toast. See note where this is set to true.

  useEffect(() => {
    setUserSelectedCurrentStrategy(nextStrategyWasSelectedByTheUser); // here, the current strategy changed, ie. the next strategy has become the current strategy, and so it's correct to copy nextStrategyWasSelectedByTheUser into userSelectedCurrentStrategy.
    setNextStrategyWasSelectedByTheUser(false); // by default, the next strategy is selected by the system. If the next strategy ends up being selected by the user, that selection code will set this to true.
    setFeeUnaffordableToastDisplayedForCurrentStrategy(false); // bestStrategy changed and so we haven't displayed a "fee unaffordable" toast for the new strategy
    // eslint-disable-next-line react-hooks/exhaustive-deps -- here we want this hook to run when the current/best strategy changes inside the button, and not based on the state we modify when it changes. Also we don't want to depend on our local `bestStrategy` because the state variables we're modifying exist to solve a race condition between our local state vs. button updating its status, so if we depend on `bestStrategy` we will cause the race condition to occur (double toasting for fee unaffordable).
  }, [status?.activeTokenTransfer]);

  useEffect(() => {
    if (strategies !== undefined && status?.error !== undefined && (status.error instanceof TransactionFeeUnaffordableError)) {
      disableAllStrategiesOriginatingFromChainId(status.activeTokenTransfer.token.chainId); // here, the user can't afford to pay the transaction fee for the active token transfer, so we'll disable all strategies for the same chainId under the assumption that if the user can't afford this strategy, they can't afford any other strategies on that same chain. WARNING this assumption is untrue in the case where a user can't afford an erc20 transfer but could afford the cheaper native currency transfer. WARNING currently, we never un-disable a chainId, so if the user becomes able to afford the transaction fee on this chain, 3cities will not currently auto-detect that. Today, the page must be reloaded to clear these disabled strategies.
      if (!feeUnaffordableToastDisplayedForCurrentStrategy && (status.buttonClickedAtLeastOnce || userSelectedCurrentStrategy)) {
        // here we have just disabled a strategy because the user can't afford to pay the transaction fee, but the user also clicked a button for this strategy at least once (either the 'pay now' button or selecting this strategy from the payment method screeen), so we are removing a strategy they interacted with, so we'll show a helpful indicator to make this less jarring.
        setFeeUnaffordableToastDisplayedForCurrentStrategy(true); // here, we flag the current strategy as having already displayed a "fee unaffordable" toast. This avoids a race condition where if both `status.buttonClickedAtLeastOnce` and `userSelectedCurrentStrategy` are both true, we'll display the toast twice because this effect is re-run when userSelectedCurrentStrategy is set to false before the next strategy has updated its initial status. An alternative to this flag would be the exclude userSelectedCurrentStrategy from this useEffect's dependencies, but I'd rather not do that because there's no eslint flag to disable a single dependency and I don't want to disable exhaustive dependencies for the entire hook as it's dangerous.
        toast.error(<div>
          <div className="text-xl">{checkoutNounCapitalized} Failed (no {getChain(status.activeTokenTransfer.token.chainId)?.nativeCurrency.symbol || 'ETH'} to pay fee)</div>
          <div className="text-lg">{checkoutNounCapitalized} method updated</div>
          <div className="text-lg">Please try again</div>
        </div>, {
          duration: 5000,
        });
      }
    }
  }, [checkoutNounCapitalized, strategies, disableAllStrategiesOriginatingFromChainId, status?.error, status?.activeTokenTransfer, status?.buttonClickedAtLeastOnce, userSelectedCurrentStrategy, feeUnaffordableToastDisplayedForCurrentStrategy, setFeeUnaffordableToastDisplayedForCurrentStrategy]);

  const canSelectNewStrategy: boolean = !( // user may select a new strategy (ie payment method) unless...
    (status?.signedTransaction // the user signed the transaction
      || status?.userIsSigningTransaction) // or the user is currently signing the transaction
    && !status.isError // and there wasn't an error, then we don't want to let the user select a new strategy because they may broadcast a successful transaction for the current transfer, and that could result in a double-spend for this Agreement (eg. the user selects a new strategy, then signs the transaction for the previous strategy, then signs a transaction for the new strategy, and there's a double spend)
  );

  const [selectingPaymentMethod, setSelectingPaymentMethod] = useState(false); // layout control variable to determine if payment method selection view is being shown

  useEffect(() => {
    if (selectingPaymentMethod // if the user is selecting a payment method
      && (
        !canSelectNewStrategy // but state updates and they can no longer select a new strategy
        || otherStrategies === undefined // or if state updates and there's no longer any other payment methods to select
        || otherStrategies.length < 1
      )
    ) setSelectingPaymentMethod(false); // then we'll close the payment select view
  }, [setSelectingPaymentMethod, selectingPaymentMethod, canSelectNewStrategy, otherStrategies]);

  const [wantToSetSelectingPaymentMethodToFalse, setWantToSetSelectingPaymentMethodToFalse] = useState(false); // wantToSetSelectingPaymentMethodToFalse is true iff the payment method select view is in the process of closing but is not yet closed. See note on `setWantToSetSelectingPaymentMethodToFalse(true);` as to why this deferral improves UX

  useEffect(() => { // here we implement the intent of wantToSetSelectingPaymentMethodToFalse deferring closing the payment method select view until the status.activeTokenTransfer has synced with the new bestStrategy.tokenTransfer. See note on `setWantToSetSelectingPaymentMethodToFalse(true);` as to why this deferral improves UX
    if (wantToSetSelectingPaymentMethodToFalse && (
      // wantToSetSelectingPaymentMethodToFalse applies if and only if both activeTokenTransfer and bestStrategy are defined and activeTokenTransfer is waiting to sync with the latest bestStrategy. So if either activeTokenTransfer or bestStrategy become undefined, then wantToSetSelectingPaymentMethodToFalse no longer applies, and we must immediately close the payment method select view lest it become stuck open:
      status?.activeTokenTransfer === undefined
      || bestStrategy === undefined
      || status.activeTokenTransfer === bestStrategy.tokenTransfer // ie. activeTokenTransfer has now synced with the latest bestStrategy, so we're ready finish deferral of actually closing the payment method select view
    )) {
      setSelectingPaymentMethod(false);
      setWantToSetSelectingPaymentMethodToFalse(false);
    }
  }, [status?.activeTokenTransfer, bestStrategy, wantToSetSelectingPaymentMethodToFalse]);

  const checkoutReadinessState:
    'receiverAddressLoading' // the CheckoutSettings.proposedPayment used an ens name for the receiver, and resolving this ens name into an address is in progress
    | 'receiverAddressCouldNotBeDetermined' // the CheckoutSettings.proposedPayment used an ens name for the receiver, and resolving this ens name into an address failed
    | 'senderAccountNotConnected' // ie. this page is has no wallet connected
    | 'senderAddressContextLoading' // this page has a wallet connected, but the connected wallet's AddressContext is still loading
    | 'senderMustSpecifyFixedAmount' // the CheckoutSettings.proposedPayment uses PayWhatYouWantMode, and a fixed amount must be specified by the sender to proceed with checkout
    | 'senderHasNoPaymentOptions' // based on the connected wallet's address context, the sender has no payment options
    | 'ready'
    = (() => {
      if (receiverAddressIsLoading) return 'receiverAddressLoading';
      else if (receiverAddress === undefined) return 'receiverAddressCouldNotBeDetermined';
      else if (!isConnected) return 'senderAccountNotConnected';
      else if (ac === undefined || (bestStrategy === undefined && isDuringConnectedAccountContextInitialLoadGracePeriod)) return 'senderAddressContextLoading';
      else if (ac !== undefined && derivedPaymentWithFixedAmount === undefined) return 'senderMustSpecifyFixedAmount';
      else if (ac !== undefined && bestStrategy === undefined) return 'senderHasNoPaymentOptions';
      else return 'ready';
    })();

  const activeDemoAccount: string | undefined = useActiveDemoAccount();

  const [buttonClickedAtLeastOnceAfterSuccessfulCaip222StyleSignature, setButtonClickedAtLeastOnceAfterSuccessfulCaip222StyleSignature] = useState(false); // buttonClickedAtLeastOnceAfterSuccessfulCaip222StyleSignature is true iff the checkout button was clicked at least once after successful collection of the caip-222-style signature as part of the checkoutSettings.authenticateSenderAddress subsystem. See note on the related useEffect below for why this exists and how it works.

  useEffect(() => { // reset when signature changes as by definition, the button has not been clicked at least once for this signature when signature changes
    if (buttonClickedAtLeastOnceAfterSuccessfulCaip222StyleSignature) setButtonClickedAtLeastOnceAfterSuccessfulCaip222StyleSignature(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- here we only want to run the hook when signature changes
  }, [caip222StyleSignature]);

  useEffect(() => {
    if (status?.buttonClickedAtLeastOnce && caip222StyleSignature) setButtonClickedAtLeastOnceAfterSuccessfulCaip222StyleSignature(true); // NB asymmetry here where we only ever set buttonClickedAtLeastOnceAfterSuccessfulCaip222StyleSignature to true and never back to false. This is because after the user signs the CAIP-222-style message, we want to conveniently auto-click the checkout button to prevent them from needing to click it twice, while only auto-clicking a single time after they've clicked the button to sign, because if eg. the user cancels the token transfer execution for any reason and/or if strategies update with auto reset and/or if they select a new payment method, then we don't want to repeatedly auto-click the button because this would represent an auto-click that wasn't prefaced by the user having clicked the button, and that's jarring UX (in the worst case, this could result in a chaotic series of auto clicks and wallet pop-ups, eg. if the button was auto resetting quickly due to a rapidly changing best strategy and auto-clicking itself each time)
  }, [status?.buttonClickedAtLeastOnce, caip222StyleSignature]);

  const activeWalletLikelyDoesntSupportAutoExecuteAfterSign: boolean = (() => { // here we attempt auto detection of an active wallet that likely doesn't support auto executing after a successful signature
    const isCoinbaseSmartWallet: boolean = Boolean(caip222StyleSignature && caip222StyleSignature.startsWith("0x0000000000000000000000000ba5ed")); // smart wallet signatures start with this pattern. smart wallet uses browser popup windows (using the browser API and not browser plugin API) to drive wallet functionality. We must disable certain auto-invocations of these because the browser blocks popups that don't originate from user actions --> TODO the signatures don't seem to always start with this. Maybe instead we should detect error `Details: Pop up window failed to open` in transactions and handle somehow? --> but once the error occurs, browser has queued pop-up suppression
    const mightBeGnosisSafeStillIndexingSignatureTransaction: boolean = Boolean(caip222StyleSignature && caip222StyleSignature.startsWith("eip1271")) && caip222StyleSignCalledAtLeastOnce; // 3cities typically detects that a gnosis safe eip1271 signature transaction has confirmed onchain before the gnosis safe public indexer catches up. Then, 3cities immediately queues the auto executed payment transaction to sign, but gnosis safe silently drops this requested transaction if the previous one's indexing confirmation page is still up. So, we flag gnosis safe as not supporting auto execute when a new eip1271 transaction has just confiremd (which is when sign was called at least once)
    return isCoinbaseSmartWallet || mightBeGnosisSafeStillIndexingSignatureTransaction;
  })();

  const authenticateSenderAddressState: { // a state machine for checkoutSettings.authenticateSenderAddress
    state:
    'notNeeded' // authenticateSenderAddress subsystem is disabled
    | 'needed' // authentication of sender address is still needed
    | 'error' // an error occurred during authentication
    | 'signingInProgress' // authentication is in progress
    | 'successWithAutoClick' // authentication was successful, and we're ready to auto-click the button once. See note on buttonClickedAtLeastOnceAfterSuccessfulCaip222StyleSignature
    | 'successWithoutAutoClick'; // authentication was successful, and we already auto-clicked the button once and won't do so again
    // NB here we don't include an error state by design: if signature is needed but the underlying signing APIs are in a permanent error state, then checkout can't proceed, which seems reasonable since the checkout was configured to authenticate the sender address but this authentication couldn't occur, so checkout can't occur
    sign?: () => void; // function to call to execute the signature collection
    signRejected?: true; // true iff the user rejected the signature request
    signature?: string; // caip-222-style signature that was needed and successfully collected
    messageThatWasSigned?: object; // the message that was signed to produce the signature
    error?: Error; // error that occurred during authentication
  } & ({
    state: 'notNeeded';
    sign?: never;
    signRejected?: never;
    // TODO consider rm signature/messageThatWasSigned as they are unused --> if this code was ever moved to a separate useAuthenticateSenderAddress, then this new hook could encapsulate use of useCaip222StyleSignature, in which case signature/messageThatWasSigned would be needed as the underlying caip222 variables would no longer be available to the client
    signature?: never;
    messageThatWasSigned?: never;
    error?: never;
  } | {
    state: 'needed';
    sign?: () => void; // NB `sign` may be unavailable, eg. if the underlying hooks are loading. If `sign` is permanently unavailable for any reason, then checkout can't proceed
    signRejected?: true;
    signature?: never;
    messageThatWasSigned?: never;
    error?: never;
  } | {
    state: 'error';
    sign?: never;
    signRejected?: never;
    signature?: never;
    messageThatWasSigned?: never;
    error: Error;
  } | {
    state: 'signingInProgress';
    sign?: never;
    signRejected?: never;
    signature?: never;
    messageThatWasSigned?: never;
    error?: never;
  } | {
    state: 'successWithAutoClick';
    sign?: never;
    signRejected?: never;
    signature: string;
    messageThatWasSigned: object;
    error?: never;
  } | {
    state: 'successWithoutAutoClick';
    sign?: never;
    signRejected?: never;
    signature: string;
    messageThatWasSigned: object;
    error?: never;
  }) = useMemo(() => {
    if (caip222StyleSignatureIsError) return {
      state: 'error',
      error: caip222StyleSignatureError,
    }; else if (checkoutSettings.authenticateSenderAddress === undefined || activeDemoAccount) return {
      state: 'notNeeded',
    }; else if (caip222StyleSignature
      && !buttonClickedAtLeastOnceAfterSuccessfulCaip222StyleSignature // auto click only the first time after successful signature. Eg. if the auto click is followed by the user rejecting the transaction, we don't want to auto-click again as this would be a jarring infinite loop of transaction confirmation pop-ups
      && caip222StyleSignCalledAtLeastOnce // if sign was never called at least once then we won't autoclick because the user didn't have to click the button for the signature to be successful, so we don't want to auto click as this would result in a transaction pop-up with zero clicks which is jarring. Zero-click caip222Style signature success  happen when the connected account uses eip1271 verification and this was previously successful (as eip1271 signatures are saved onchain)
      && !activeWalletLikelyDoesntSupportAutoExecuteAfterSign // ie. never auto execute if active wallet likely doesn't support it
    ) return {
      state: 'successWithAutoClick',
      signature: caip222StyleSignature,
      messageThatWasSigned: caip222StyleMessageThatWasSigned,
    }; else if (caip222StyleSignature) return {
      state: 'successWithoutAutoClick',
      signature: caip222StyleSignature,
      messageThatWasSigned: caip222StyleMessageThatWasSigned,
    }; else if (caip222StyleSignatureIsLoading && caip222StyleSignatureLoadingStatus === "SigningInProgress") return {
      state: 'signingInProgress',
    }; else return {
      state: 'needed',
      ...(caip222StyleExecuteSign && { sign: caip222StyleExecuteSign }),
      ...(caip222StyleSignRejected && { signRejected: true }),
    };
  }, [checkoutSettings.authenticateSenderAddress, activeDemoAccount, caip222StyleSignature, caip222StyleMessageThatWasSigned, caip222StyleExecuteSign, caip222StyleSignRejected, caip222StyleSignCalledAtLeastOnce, caip222StyleSignatureIsLoading, caip222StyleSignatureLoadingStatus, caip222StyleSignatureIsError, caip222StyleSignatureError, buttonClickedAtLeastOnceAfterSuccessfulCaip222StyleSignature, activeWalletLikelyDoesntSupportAutoExecuteAfterSign]);

  const [signedTransactionIframeMsgSent, setSignedTransactionIframeMsgSent] = useState(false);
  useEffect(() => {
    if (status?.signedTransaction && !signedTransactionIframeMsgSent) { // NB our strategy here is to notify the iframe as soon as a transaction is signed and before it confirms. This helps minimize the time window for a race condition where the user might close the window before the transaction details have been securely communicated to any server in the parent window. If we instead waited until checkout (ie. transaction confirmation), then we'd know the transaction confirmed, but more time would have elapsed - potentially a lot more time - giving a dangerous time window where the user could close the tab and prevent their transaction details from being sent to any server
      if (isRunningInAnIframe) {
        const txSignedIframeMsg: IframeMessage<'TransactionSigned'> = {
          kind: 'TransactionSigned',
          transactionHash: status.signedTransaction.transactionHash,
          chainId: status.signedTransaction.chainId,
          ...(caip222StyleSignature && { caip222StyleSignature }),
          ...(caip222StyleMessageThatWasSigned && { caip222StyleMessageThatWasSigned }),
          receiptUrl: getBlockExplorerUrlForTransaction(status.signedTransaction.chainId, status.signedTransaction.transactionHash),
          tokenCurrency: getLogicalAssetTickerForTokenOrNativeCurrencyTicker(status.signedTransaction.tokenTransfer.token.ticker),
          tokenTicker: status.signedTransaction.tokenTransfer.token.ticker,
          tokenName: status.signedTransaction.tokenTransfer.token.name,
          tokenAmount: status.signedTransaction.tokenTransfer.amount.toString(),
          tokenDecimals: status.signedTransaction.tokenTransfer.token.decimals,
          tokenContractAddress: status.signedTransaction.tokenTransfer.token.contractAddress,
          chainName: getChain(status.signedTransaction.chainId)?.name,
          isTestnet: getChain(status.signedTransaction.chainId)?.testnet,
        };
        notifyParentWindowOfTransactionSigned(checkoutSettings.iframeParentWindowOrigin, txSignedIframeMsg);
      }
      setSignedTransactionIframeMsgSent(true); // NB we never reset signedTransactionIframeMsgSent to false as Pay is currently designed to be a single-use component
    }
  }, [checkoutSettings.iframeParentWindowOrigin, status?.signedTransaction, caip222StyleSignature, caip222StyleMessageThatWasSigned, signedTransactionIframeMsgSent]);

  const [checkoutIframeMsgSent, setCheckoutIframeMsgSent] = useState(false);
  useEffect(() => { // iframe postMessage Checkout on status.isSuccess, informing the parent window that a successful checkout has occurred
    if (statusIsSuccess && !checkoutIframeMsgSent) {
      if (isRunningInAnIframe) {
        const checkoutIframeMsg: IframeMessage<'Checkout'> = {
          kind: 'Checkout', // here we specify the kind of message as 'Checkout', abstracting over the type of payment strategy used to complete the checkout. For example, the checkout might have been completed with a single token transfer, or (in future) via bridging, via defi position, etc
          // TODO re-pass transaction data and share its generation with TransactionSigned iframe msg
        };
        notifyParentWindowOfSuccessfulCheckout(checkoutSettings.iframeParentWindowOrigin, checkoutIframeMsg);
      }
      setCheckoutIframeMsgSent(true); // NB we never reset checkoutIframeMsgSent to false as Pay is currently designed to be a single-use component
    }
  }, [checkoutSettings.iframeParentWindowOrigin, statusIsSuccess, checkoutIframeMsgSent]);


  const executeTokenTransferButtonPropValues = useMemo((): Pick<ExecuteTokenTransferButtonProps, 'onClickPassthrough' | 'autoClickIfNeverClicked' | 'warningLabel' | 'errorLabel' | 'disabled' | 'showLoadingSpinnerWhenDisabled'> => {
    switch (authenticateSenderAddressState.state) {
      case 'notNeeded': return {
        autoClickIfNeverClicked: false,
      }; case 'needed': return {
        ...(authenticateSenderAddressState.sign && { onClickPassthrough: authenticateSenderAddressState.sign } satisfies Pick<ExecuteTokenTransferButtonProps, 'onClickPassthrough'>),
        ...(authenticateSenderAddressState.signRejected && { warningLabel: <span>Rejected<br />in wallet</span> } satisfies Pick<ExecuteTokenTransferButtonProps, 'warningLabel'>),
        autoClickIfNeverClicked: false,
        ...(!authenticateSenderAddressState.sign && { // if underlying sign is unavailable, we'll show the button as loading in the hopes that sign may soon become available. If sign never becomes unavailable, checkout can't proceed
          disabled: 'Pay Now', // here we show the disabled label as 'Pay Now' such that the button looks the same if caip222style's sign or initial eip1271 verification is loading as when the button is laoding ordinarily without use of caip222. If instead we used "Sign Message in Wallet" here, then the button would briefly flicker "Sign Message in Wallet" for accounts with eip1271 signature verification when a signature was previously verified and didn't require re-verification
          showLoadingSpinnerWhenDisabled: true,
        } satisfies Pick<ExecuteTokenTransferButtonProps, 'disabled' | 'showLoadingSpinnerWhenDisabled'>),
      }; case 'error': return {
        errorLabel: authenticateSenderAddressState.error.message,
        disabled: true,
      }; case 'signingInProgress': return {
        autoClickIfNeverClicked: false,
        disabled: 'Sign Message in Wallet',
        showLoadingSpinnerWhenDisabled: true,
      }; case 'successWithAutoClick': return {
        autoClickIfNeverClicked: true,
      }; case 'successWithoutAutoClick': return {
        autoClickIfNeverClicked: false,
      };
    }
  }, [authenticateSenderAddressState.state, authenticateSenderAddressState.sign, authenticateSenderAddressState.signRejected, authenticateSenderAddressState.error?.message]);


  const makeExecuteTokenTransferButton = useCallback((tt: TokenTransfer | undefined, disabled?: true | string) => {
    const computedExecuteTokenTransferButtonPropValues: typeof executeTokenTransferButtonPropValues = {
      ...executeTokenTransferButtonPropValues,
      ...((activeDemoAccount !== undefined || disabled !== undefined) && { disabled: typeof disabled === 'string' ? disabled : true as const }), // we must prioritize the passed disabled as that's what makeExecuteTokenTransferButton guarantees to its clients
    };

    return <div className="relative"><ExecuteTokenTransferButton
      {...computedExecuteTokenTransferButtonPropValues}
      tt={tt}
      nativeTokenTransferProxy={checkoutSettings.nativeTokenTransferProxy}
      autoReset={true}
      loadForeverOnTransactionFeeUnaffordableError={true}
      label={`${checkoutVerbCapitalized} Now`}
      successLabel="Paid ✅"
      className="rounded-md p-3.5 font-medium bg-primary sm:enabled:hover:bg-primary-darker focus:outline-none enabled:active:scale-95 sm:enabled:hover:cursor-pointer w-full"
      disabledClassName="text-gray-200 pointer-events-none"
      enabledClassName="text-white"
      errorClassName="text-red-600"
      warningClassName="text-black"
      loadingSpinnerClassName="text-gray-200 fill-primary"
      {...(activeDemoAccount === undefined && { setStatus } satisfies Pick<ExecuteTokenTransferButtonProps, 'setStatus'>)}
    />
      {!retryButton && activeDemoAccount && (
        <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-black text-sm whitespace-nowrap text-center">
          disconnect demo<br />account to pay
        </span>
      )}
      {retryButton}
    </div>;
  }, [checkoutSettings.nativeTokenTransferProxy, setStatus, checkoutVerbCapitalized, activeDemoAccount, retryButton, executeTokenTransferButtonPropValues]);

  const paymentScreen: false | JSX.Element = useMemo(() => !statusIsSuccess && <div className={`${selectingPaymentMethod ? 'hidden' : '' /* WARNING here we hide the payment screen when selecting payment method instead of destroying it. This avoids an ExecuteTokenTransferButton remount each time the payment method changes, which is a mechanism to test reset logic and code paths. */}`}>
    <div className="w-full py-6">
      {(() => {
        const payWhatYouWantAmountHeader = <span className="w-full font-semibold">Select amount to {checkoutVerbLowercase}</span>;

        const makePayWhatYouWantAmountUiNoSuggestedAmounts = ({ includeAmountHeader }: { includeAmountHeader: boolean }): JSX.Element => {
          return <div className="w-full flex flex-col items-center justify-center mb-6">
            {includeAmountHeader === true && payWhatYouWantAmountHeader}
            <div className="w-full mt-2"><CurrencyAmountInput logicalAssetTicker={payWhatYouWantLogicalAssetTickerFromInput} inputId="CurrencyAmountInput" setAmount={setRawPayWhatYouWantAmountFromInput} /></div>
            <div className="w-full flex flex-wrap justify-between items-center gap-2 mt-6">
              <span className="w-full font-semibold">Currency</span>
              {payWhatYouWantLogicalAssetTickerSelectionInputElement}
            </div>
          </div>;
        };

        const maybeMakePayWhatYouWantAmountUiNoSuggestedAmounts = (el: JSX.Element) => { // see design note on maybeMakeFixedAmountUiMaybeWithSuggestedAmounts
          if (checkoutSettings.proposedPayment.paymentMode.payWhatYouWant !== undefined && checkoutSettings.proposedPayment.paymentMode.payWhatYouWant.suggestedLogicalAssetAmounts.length < 1) return <div>{makePayWhatYouWantAmountUiNoSuggestedAmounts({ includeAmountHeader: true })}{el}</div>; else return el;
        }

        const payWhatYouWantAmountUiWithSuggestedAmounts: JSX.Element = (() => {
          return <>
            <div className="w-full flex flex-col items-center justify-center gap-2 mb-6">
              {payWhatYouWantAmountHeader}
              <div className="w-full flex flex-wrap items-center justify-between gap-6">
                {(checkoutSettings.proposedPayment.paymentMode.payWhatYouWant?.suggestedLogicalAssetAmounts || []).map((a, i) => {
                  return <button
                    key={i}
                    type="button"
                    disabled={payWhatYouWantSelectedSuggestedAmount === a}
                    className="focus:outline-none rounded-md min-w-[6em] px-2 py-1 font-medium border border-primary enabled:active:scale-95 enabled:bg-white enabled:text-primary sm:enabled:hover:bg-primary sm:enabled:hover:text-white disabled:bg-primary disabled:text-white disabled:cursor-not-allowed"
                    onClick={() => startTransition(() => { // NB wrap this state update in startTransition because it causes strategies to be synchronously regenerated and we want the UI to remain snappy during this process
                      setPayWhatYouWantSelectedSuggestedAmount(a);
                      setRawPayWhatYouWantAmountFromInput(undefined); // clear any previously set "other" amount so that the next time the user clicks on "other", the old, stale amount isn't still there, which causes UI jank where the old, stale amount is briefly used to generate a strategy pipeline before the newly mounted CurrencyAmountInput sets it to undefined
                    })}
                  >
                    <RenderLogicalAssetAmount
                      logicalAssetTicker={checkoutSettings.proposedPayment.logicalAssetTickers.primary /* suggested amounts always use the original logical asset ticker, or else the suggested amount denominations would change when the sender selects a different logical asset during 'Other' */}
                      amount={a}
                    />
                  </button>;
                })}
                <button
                  type="button"
                  disabled={payWhatYouWantSelectedSuggestedAmount === "other"}
                  className="focus:outline-none rounded-md  min-w-[6em] px-2 py-1 font-medium border border-primary enabled:active:scale-95 enabled:bg-white enabled:text-primary sm:enabled:hover:bg-primary sm:enabled:hover:text-white disabled:bg-primary disabled:text-white disabled:cursor-not-allowed"
                  onClick={() => setPayWhatYouWantSelectedSuggestedAmount("other")}
                >Other</button>
              </div>
            </div>
            {payWhatYouWantSelectedSuggestedAmount === "other" && makePayWhatYouWantAmountUiNoSuggestedAmounts({ includeAmountHeader: false })}
          </>;
        })();

        const maybeMakePayWhatYouWantAmountUiMaybeWithSuggestedAmounts = (el: JSX.Element) => { // the idea here with maybeMakeFixedAmountUiNoSuggestedAmounts vs. maybeMakeFixedAmountUiMaybeWithSuggestedAmounts is that if we may show a fixed amount UI that includes suggested amounts, then we never want to show it until the sender's account context had a chance to load because the suggested amounts may be adjusted based on the sender's wallet contents, so if we eagerly displayed suggested amounts, then they'd jankily change as the sender's account context loads. In contrast, if we won't show suggested amounts (ie. because the payment has no suggested amounts), then we'll show the amount input widget earlier during rendering, before the sender's account context is loaded and even before the receiver's address is loaded
          if (checkoutSettings.proposedPayment.paymentMode.payWhatYouWant !== undefined) {
            if (checkoutSettings.proposedPayment.paymentMode.payWhatYouWant.suggestedLogicalAssetAmounts.length < 1) return <div>{makePayWhatYouWantAmountUiNoSuggestedAmounts({ includeAmountHeader: true })}{el}</div>;
            else return <div>{payWhatYouWantAmountUiWithSuggestedAmounts}{el}</div>;
          } else return el;
        }

        const isInAnIframe: boolean = window.self !== window.top;
        if (checkoutSettings.requireInIframeOrErrorWith && !isInAnIframe) return maybeMakePayWhatYouWantAmountUiMaybeWithSuggestedAmounts(<button
          type="button"
          className="rounded-md p-3.5 bg-tertiary text-black pointer-events-none w-full"
        >
          {checkoutSettings.requireInIframeOrErrorWith}
        </button>); else if (!isConnected) return <ConnectWalletButton disconnectedLabel={`Connect Wallet to ${checkoutVerbCapitalized}`} />; // TODO replace this with ConnectWalletButtonCustom where the styling props passed are from local variables shared with ExecuteTokenTransferButton. This ensures the styles of the two buttons are exactly the same (whereas today, they are only coincidentally the same), preventing UI jank after connecting wallet
        else switch (checkoutReadinessState) {
          case 'receiverAddressCouldNotBeDetermined': return maybeMakePayWhatYouWantAmountUiNoSuggestedAmounts(<button
            type="button"
            className="rounded-md p-3.5 bg-tertiary text-black pointer-events-none w-full"
          >
            Receiver ENS name has no address
          </button>); // here we include the fixed amount UI to avoid jank even though the sender can't complete the payment due to no receiver address
          case 'senderAccountNotConnected': throw new Error("expected checkoutReadinessState to not be receiverAddressReadyButSenderAccountNotConnected when sender account is connected"); // here we never expect receiverAddressReadyButSenderAccountNotConnected because this switch statement is `else isConnected`
          case 'senderHasNoPaymentOptions': return maybeMakePayWhatYouWantAmountUiMaybeWithSuggestedAmounts(<button
            type="button"
            className="rounded-md p-3.5 bg-tertiary text-black pointer-events-none w-full"
          >
            Connected wallet has no {checkoutNounLowercase} options
          </button>);
          case 'receiverAddressLoading': return maybeMakePayWhatYouWantAmountUiNoSuggestedAmounts(makeExecuteTokenTransferButton(undefined));
          case 'senderAddressContextLoading': return maybeMakePayWhatYouWantAmountUiNoSuggestedAmounts(makeExecuteTokenTransferButton(undefined));
          case 'senderMustSpecifyFixedAmount': return maybeMakePayWhatYouWantAmountUiMaybeWithSuggestedAmounts(makeExecuteTokenTransferButton(undefined, `${checkoutVerbCapitalized} Now`));
          case 'ready': if (bestStrategy === undefined) throw new Error("expected bestStrategy to be defined when checkoutReadinessState is 'ready'"); else return maybeMakePayWhatYouWantAmountUiMaybeWithSuggestedAmounts(makeExecuteTokenTransferButton(bestStrategy.tokenTransfer));
        }
      })()}
    </div>
    {(() => {
      const fixedPayment: PaymentWithFixedAmount | ProposedPaymentWithFixedAmount | undefined = derivedPaymentWithFixedAmount || proposedPaymentWithFixedAmount;
      const willShowTotalSection: boolean = fixedPayment !== undefined;
      const willShowNoteSection: boolean = checkoutSettings.note !== undefined;
      return <>
        <div className={`p-4 flex items-center gap-4 justify-between w-full border border-gray-300 bg-white ${!willShowTotalSection && !willShowNoteSection ? 'rounded-md' /* if neither the total or note sections will display, then the To section is both the first and last section and needs all of its corners rounded */ : 'rounded-t-md'}`}>
          <span>To:</span>
          <span className="font-bold inline-flex gap-1 place-content-between" style={{ overflowWrap: 'anywhere' }}>
            <span>{!showFullReceiverAddress && (truncateEnsName(receiverEnsName) || truncateEthAddress(receiverAddress))}{showFullReceiverAddress && receiverAddress && `${receiverAddress}${receiverEnsName ? ` (${receiverEnsName})` : ''}`}{showFullReceiverAddress && !receiverAddress && receiverEnsName}{showFullReceiverAddress && receiverAddressBlockExplorerLink && <ExternalLink href={receiverAddressBlockExplorerLink} className="ml-1">explorer</ExternalLink>}</span>
            <span className="flex place-items-center"><FaEye onClick={() => setShowFullReceiverAddress(v => !v)} className="w-4 sm:hover:text-gray-500 sm:hover:cursor-pointer" /></span>
          </span>
        </div>
        {willShowNoteSection && <div className={`p-4 flex items-center w-full border-b border-x border-gray-300 bg-white ${!willShowTotalSection ? 'rounded-b-md' /* if the total section won't display, then the Note section is the last section and needs its bottom corners rounded */ : ''}`}>
          <span className="text-left">{checkoutSettings.note}</span>
        </div>}
        {willShowTotalSection && fixedPayment !== undefined && <div className="p-4 grid grid-cols-6 w-full border-b border-x border-gray-300 bg-white text-lg rounded-b-md">
          <span className="font-bold col-span-2">Total:</span>
          <span className="font-bold text-right col-span-4"><RenderLogicalAssetAmount
            logicalAssetTicker={fixedPayment.logicalAssetTickers.primary}
            amount={fixedPayment.paymentMode.logicalAssetAmount}
          /></span>
          {(() => {
            // We'll attempt to display a secondary logical asset amount below the primary logical asset amount. NB here we have a bias for USD in that if the payment's primary logical asset is not USD, we unconditionally attempt to show its USD equivalent, but if the payment's primary logical asset is USD, we only conditionally attempt to show its non-USD equivalent. This asymmetry (USD bias) is because most users seem to prefer USD.
            type OtherLogicalAssetAmountToDisplay = {
              lat: LogicalAssetTicker;
              amount: bigint;
            }
            const otherLogicalAssetAmountToDisplay: OtherLogicalAssetAmountToDisplay | 'preserve space' | 'collapse space' = (() => {
              if (fixedPayment.logicalAssetTickers.primary === 'USD') {
                const mostRelevantSecondaryLat = ((): LogicalAssetTicker | undefined => {
                  const activeTokenTransferOrBestStrategyTokenTicker: Uppercase<string> | undefined = (status?.activeTokenTransfer || bestStrategy?.tokenTransfer)?.token.ticker;
                  if (activeTokenTransferOrBestStrategyTokenTicker) return getLogicalAssetTickerForTokenOrNativeCurrencyTicker(activeTokenTransferOrBestStrategyTokenTicker); // we'll define the most relevant secondary logical asset ticker as the one associated with the current active token transfer (falling back to bestStrategy to avoid UI jank where it's known that active token transfer will soon become defined), if any, since the active token transfer is the one is currently to be used for payment. NB if the activeTokenTransfer is denominated in USD, then the most relevant "secondary" lat will be the same as the primary lat (and then not displayed below)
                  else return proposedStrategies.map(ps => getLogicalAssetTickerForTokenOrNativeCurrencyTicker(ps.proposedTokenTransfer.token.ticker)).find(lat => lat !== undefined && lat !== 'USD') // we'll define the second most relevant secondary logical asset ticker as the one associated with the highest-priority proposed strategy that's not denominated in USD because these proposed strategies are based on live exchange rates and contextual prioritization. Here, we use the first non-USD proposed strategy even if a USD proposed strategy may be higher priority to showcase 3cities's exchange rate functionality
                    || (!isConnected ? fixedPayment.logicalAssetTickers.secondaries[0] : undefined); // we'll define the least relevant secondary logical asset ticker as the highest-priority of the payment secondaries only if the wallet not connected. This helps showcase 3cities's exchange rate capability when the wallet isn't connected, while avoiding UI jank if the wallet is connected because then, it's likely that soon (eg. after strategies finish loading), activeTokenTransfer will become USD-denominated, resulting in no secondary logical asset equivalent being displayed (as we don't display a non-USD equivalent if activeTokenTransfer is in USD for a USD payment). Ie. if we were to drop `!isConnected` here, then a typical page load for a USD payment with an already-connected wallet would have jank where the extra space for secondary equivalent is shown briefly until strategies finish loading and activeTokenTransfer likely becomes USD-denominated (and if activeTokenTransfer becomes non-USD-denominated, then we'll show a bit of jank where the space soon expands to display the non-USD equivalent, which is fine)
                })();
                if (mostRelevantSecondaryLat && mostRelevantSecondaryLat !== 'USD') {
                  const paymentAmountInMostRelevantSecondaryLat: bigint | undefined = convert({ er: exchangeRates, fromTicker: 'USD', toTicker: mostRelevantSecondaryLat, fromAmount: fixedPayment.paymentMode.logicalAssetAmount });
                  if (paymentAmountInMostRelevantSecondaryLat !== undefined) return {
                    lat: mostRelevantSecondaryLat,
                    amount: paymentAmountInMostRelevantSecondaryLat,
                  }; else return 'preserve space'; // here we 'preserve space' because the most likely reason that paymentAmountInMostRelevantSecondaryLat is undefined is because exchange rates are initially loading, so we don't want to collapse the space now only to have it un-collapse after rates finish loading and cause UI jank
                } else return 'collapse space'; // no relevant non-USD secondary lat was found and one is unlikely to be automatically found soon, so we collapse space to avoid the ugly blank space
              } else { // the payment's primary logical asset is not USD, so we always show the USD equivalent (see note above on our asymmetric bias for USD)
                const usdAmount: bigint | undefined = convert({ er: exchangeRates, fromTicker: fixedPayment.logicalAssetTickers.primary, toTicker: 'USD', fromAmount: fixedPayment.paymentMode.logicalAssetAmount });
                if (usdAmount !== undefined) return {
                  lat: 'USD',
                  amount: usdAmount,
                }; else return 'preserve space';
              }
            })();
            return otherLogicalAssetAmountToDisplay !== 'collapse space' ? <>
              <span className="col-span-2"></span> {/* empty span to align grid cols*/}
              <span className="text-gray-500 text-right col-span-4">{otherLogicalAssetAmountToDisplay !== 'preserve space' ? <RenderLogicalAssetAmount
                logicalAssetTicker={otherLogicalAssetAmountToDisplay.lat}
                amount={otherLogicalAssetAmountToDisplay.amount}
              /> : <span>&nbsp;</span>}</span>
            </> : undefined;
          })()}
        </div>}
      </>;
    })()}
    {isConnected && /* WARNING here render payment method section only if isConnected as a render optimization because when disconnecting the wallet, bestStrategy does not become undefined until event callbacks clear the ExecuteTokenTransferButton status because bestStrategy is computed using status.activeTokenTransfer. So here, we don't render Payment Method if disconnected to avoid briefly rendering it with a stale bestStrategy after wallet becomes disconnected */ bestStrategy !== undefined && <div className="mt-6 w-full">
      <div className="font-bold text-lg">{checkoutVerbCapitalized} with</div>
      <div className="mt-2 p-4 border border-gray-300 bg-white rounded-md flex flex-col gap-2 justify-between items-start">
        <div className="w-full flex gap-2 justify-start items-center">
          {(() => {
            return <span className="flex justify-between gap-2 items-center">
              <RenderTokenTransfer tt={status?.activeTokenTransfer || bestStrategy.tokenTransfer} opts={{ hideAmount: true }} />
              {strategies !== undefined && bestStrategy === strategies[0] /* WARNING here condition only on bestStrategy and not activeTokenTransfer when displaying BestStrategyLabel, meaning BestStrategyLabel may be displayed even if activeTokenTransfer is not the current bestStrategy */ ? <BestStrategyLabel /> : undefined}
            </span>;
          })()}
          {canSelectNewStrategy && otherStrategies && otherStrategies.length > 0 && <span className="text-xs"><button
            onClick={() => setSelectingPaymentMethod(true)}
            className="relative flex-0 rounded-md px-2 py-0.5 mr-2 bg-gray-200 sm:hover:bg-gray-300 focus:outline-none enabled:active:scale-95 sm:enabled:hover:cursor-pointer"
            type="button"
          >
            change
          </button></span>}
        </div>
        <span className="text-gray-500 text-xs">{(otherStrategies || []).length + 1 /* + 1 because we count the current bestStrategy among the methods */} payment method{(otherStrategies || []).length > 0 ? 's' : ''} across {[... new Set((strategies || []).map(s => s.tokenTransfer.token.chainId))].length} chain{[... new Set((strategies || []).map(s => s.tokenTransfer.token.chainId))].length > 1 ? 's' : ''}</span>
      </div>
    </div>}
  </div>, [checkoutVerbLowercase, checkoutVerbCapitalized, checkoutNounLowercase, startTransition, isConnected, checkoutSettings.note, checkoutSettings.proposedPayment.logicalAssetTickers.primary, checkoutSettings.proposedPayment.paymentMode.payWhatYouWant, checkoutSettings.requireInIframeOrErrorWith, proposedPaymentWithFixedAmount, receiverAddress, receiverAddressBlockExplorerLink, receiverEnsName, payWhatYouWantSelectedSuggestedAmount, setPayWhatYouWantSelectedSuggestedAmount, setRawPayWhatYouWantAmountFromInput, payWhatYouWantLogicalAssetTickerFromInput, payWhatYouWantLogicalAssetTickerSelectionInputElement, derivedPaymentWithFixedAmount, exchangeRates, proposedStrategies, strategies, bestStrategy, otherStrategies, canSelectNewStrategy, checkoutReadinessState, makeExecuteTokenTransferButton, showFullReceiverAddress, status?.activeTokenTransfer, statusIsSuccess, selectingPaymentMethod]);

  const acceptedTokensAndChainsElement: false | JSX.Element = useMemo(() => !statusIsSuccess && <div className="w-full">
      {(() => {
        const allStrategiesTokenTickers: string[] = [... new Set(proposedStrategies.map(ps => ps.proposedTokenTransfer.token.ticker))];
        const allStrategiesChainIds: number[] = [... new Set(proposedStrategies.map(ps => ps.proposedTokenTransfer.token.chainId))];
        return <>
          <div className="pt-6 font-bold text-lg">Ways to pay</div>
          <div className="mt-2 p-4 border border-gray-300 bg-white rounded-md">
            <span className="font-bold">Tokens:</span> {allStrategiesTokenTickers.join(", ")} <br />
            {/* <span className="font-bold">on</span> */}
            <span className="font-bold">Chains:</span> {allStrategiesChainIds.map(getSupportedChainName).join(", ")}
          </div>
        </>;
      })()}
    </div>, [statusIsSuccess, proposedStrategies]);

  const selectPaymentMethodScreen: false | JSX.Element = useMemo(() => bestStrategy !== undefined && otherStrategies !== undefined && otherStrategies.length > 0 && <div className={`grid grid-cols-1 w-full items-center py-6 ${selectingPaymentMethod ? '' : 'hidden'}`}>
    <div className="font-bold text-2xl">Select a {checkoutNounLowercase} method</div>
    <div className="my-2 flex items-end justify-between">
      <div className="font-bold text-lg">{checkoutVerbCapitalized} with</div>
      <div className="font-bold text-sm">Your balance</div>
    </div>
    {[bestStrategy, ...otherStrategies].map((s, i) => {
      const tk = getTokenKey(s.tokenTransfer.token);
      const tb = ac?.tokenBalances[tk];
      return <div key={tk /* WARNING in the future, eg. after we add auto-bridging, the token key may become insufficient to uniquely determine a strategy. Instead, we may want something like getStrategyKey or Strategy.key (where `key` is the shape of the strategy, eg. as used in bestStrategy to preserve strategy selection across strategies regeneration) and perhaps also Strategy.instanceId (where instanceId is the unique id for that actually strategy instance) */}
        className={`flex gap-2 justify-between px-4 py-2 ${i > 1 ? 'border-t' : ''} ${i > 0 ? 'border-x' : ''} ${i === 0 ? 'border-2 border-secondary' : 'border-gray-300'} bg-white ${i === otherStrategies.length /* NB absence of -1 because array is one longer due to prepend of bestStrategy */ ? 'border-b' : ''} ${i === 0 ? 'rounded-t-md' : ''} ${i === otherStrategies.length /* NB absence of -1 because array is one longer due to prepend of bestStrategy */ ? 'rounded-b-md' : ''} sm:hover:cursor-pointer focus:outline-none active:scale-95 sm:hover:bg-gray-200`}
        onClick={() => {
          if (!wantToSetSelectingPaymentMethodToFalse) { // NB iff wantToSetSelectingPaymentMethodToFalse, then we are in the process of closing the payment method screen and don't allow selecting a new payment method (can only select a payment method when the payment method screen is "fully open")
            if (i > 0 && canSelectNewStrategy) {
              selectStrategy(s);
              setNextStrategyWasSelectedByTheUser(true);
              // WARNING here we must not call status.reset() because canSelectNewStrategy is intended to be true iff autoReset=true will auto-reset the button. If instead we called reset here, and there was some state inconsistency between our view and the button's view of the transfer, then it's possible that we might reset the button after it's unsafe to do so (eg. when user may sign a tx for the old transfer) and risk causing a double payment.
            }
            setWantToSetSelectingPaymentMethodToFalse(true); // here, we express intent to close the payment method screen instead of closing it directly with `setSelectingPaymentMethod(false)`. This delays the actual closing of the payment method screen, allowing time for status.activeTokenTransfer to be updated to the latest bestStrategy (as activeTokenTransfer only updates on ExecuteTokenTransferButton internal useEffect). If instead we closed the payment screen directly, then in some cases, the user experiences UI jank as the old active token transfer is still being rendered before immediately transitioning to render the new best strategy
          }
        }}>
        <RenderTokenTransfer tt={s.tokenTransfer} opts={{ hideAmount: true }} />
        {strategies && s === strategies[0] && <BestStrategyLabel />}
        {ac !== undefined && tb && <span className="text-right"> <RenderTokenBalance tb={tb} opts={{ hideChainSeparator: true, hideChain: true }} /></span>}
      </div>
    })}
  </div>, [checkoutVerbCapitalized, checkoutNounLowercase, ac, strategies, bestStrategy, otherStrategies, canSelectNewStrategy, selectStrategy, selectingPaymentMethod, wantToSetSelectingPaymentMethodToFalse, setWantToSetSelectingPaymentMethodToFalse]);

  const paymentSuccessfulBlockExplorerReceiptLink: string | undefined = (() => {
    if (!status?.isSuccess) return undefined;
    else return getBlockExplorerUrlForTransaction(status.activeTokenTransfer.token.chainId, status.successData.transactionHash);
  })();

  // NB when using redirect URLs and webhooks, there are at least three reasonable ways to help a receiver/seller distinguish distinct senders/buyers using the same pay link: 1. pass-through url params, 2. checkoutSettings.reference, 3. embedded pay link using iframe message passing to receive the host page url and including it here (and then the host page url would need to have uniquely identifiable information for the distinct sender/buyer). And if the receiver/seller uses one pay link per buyer, the seller can then store the pay links in a DB and we can submit the pay link.

  const successRedirectOnClick: (() => void) | undefined = useMemo(() => { // successRedirectOnClick is defined iff the payment has been successful and a redirect now needs to be executed, in which case successRedirectOnClick itself is the onClick function for a button executing this redirect
    if (statusIsSuccess && checkoutSettings.successAction?.redirect) {
      const srd = checkoutSettings.successAction?.redirect;
      const urlWithVariableSubstitutions = applyVariableSubstitutions(srd.url, {
        R: encodeURIComponent(paymentSuccessfulBlockExplorerReceiptLink || ''),
      });
      return () => { // TODO support pass-through url params where arbitrary url params on the pay link are auto-forwarded to the redirect url
        if (srd.openInNewTab) window.open(urlWithVariableSubstitutions, '_blank');
        else window.location.href = urlWithVariableSubstitutions;
      };
    } else return undefined;
  }, [checkoutSettings.successAction?.redirect, statusIsSuccess, paymentSuccessfulBlockExplorerReceiptLink]);

  const paymentSuccessfulBaseText: string = (() => {
    if (derivedPaymentWithFixedAmount && status?.isSuccess) {
      return `Hey, I ${checkoutSettings.mode === "deposit" ? "deposited" : "paid you"} ${renderLogicalAssetAmount({
        logicalAssetTicker: derivedPaymentWithFixedAmount.logicalAssetTickers.primary,
        amount: derivedPaymentWithFixedAmount.paymentMode.logicalAssetAmount,
      })}${checkoutSettings.note ? ` for ${checkoutSettings.note}` : ''} using 3cities.xyz`;
    } else return ' ';
  })();

  const paymentSuccessfulTextNoLinkToShare: string = (() => {
    if (status?.isSuccess) {
      const computedReceiptWithoutLink = paymentSuccessfulBlockExplorerReceiptLink ? `` : ` ${checkoutNounCapitalized} transaction hash: ${status.successData.transactionHash} on ${getSupportedChainName(status.activeTokenTransfer.token.chainId)}`; // the idea here is that we'll include the verbose "Transaction hash ..." as a "manual non-link receipt" iff the actual payment receipt link couldn't be constructed. This provides a fallback while avoiding including the spammy "transaction hash" text in the case where link is available.
      return `${paymentSuccessfulBaseText}${computedReceiptWithoutLink}`;
    } else return ' ';
  })();

  const paymentSuccessfulTextWithLinkToShare: string = (() => {
    if (status?.isSuccess) {
      const computedReceipt = paymentSuccessfulBlockExplorerReceiptLink ? `Receipt: ${paymentSuccessfulBlockExplorerReceiptLink}` : `${checkoutNounCapitalized} transaction hash: ${status.successData.transactionHash} on ${getSupportedChainName(status.activeTokenTransfer.token.chainId)}`;
      return `${paymentSuccessfulBaseText} ${computedReceipt}`;
    } else return ' ';
  })();

  const [isPaymentSuccessfulShareCopied, setIsPaymentSuccessfulShareCopied] = useClipboard(paymentSuccessfulTextWithLinkToShare, {
    successDuration: 2000, // `isCopied` will go back to `false` after 2000ms
  });

  const toShare = {
    // title: "Money sent", // we omit title because some share contexts include it, some omit it, and we prefer our share content to be minimalist and consistently include no title
    text: paymentSuccessfulTextNoLinkToShare,
    ...(paymentSuccessfulBlockExplorerReceiptLink && { url: paymentSuccessfulBlockExplorerReceiptLink }),
  };
  const canShare: boolean = navigator.canShare && navigator.canShare(toShare); // test the Web Share API on desktop by enabling this flag chrome://flags/#web-share
  const paymentSuccessfulScreen: JSX.Element | undefined = status?.isSuccess ? <div className="grid grid-cols-1 w-full items-center pt-6 gap-6">
    <button
      type="button"
      className="rounded-md p-3.5 font-medium bg-primary-lighter-2 text-white pointer-events-none w-full"
    >
      {checkoutNounCapitalized} Successful ✅
    </button>
    {(function computedSuccessAction(): React.ReactNode { // handle checkoutSettings.successAction
      // smallReceiptLink is an unobtrusive payment receipt link intended to be displayed as a secondary element alongside a computed success action that's a primary call-to-action for the user to click it
      const smallReceiptLink = paymentSuccessfulBlockExplorerReceiptLink !== undefined && <div className="flex flex-col justify-center items-center">
        <ExternalLink href={paymentSuccessfulBlockExplorerReceiptLink} className="text-sm"><span>{checkoutNounCapitalized} receipt</span></ExternalLink>
      </div>;
      // largeReceiptQRCode is a large receipt link intended to be displayed as a primary element alongside a computed success action that lacks a primary call-to-action
      const largeReceiptQRCode = paymentSuccessfulBlockExplorerReceiptLink !== undefined && <div className="flex flex-col justify-center items-center gap-2">
        <QRCode data={paymentSuccessfulBlockExplorerReceiptLink} />
        <span>Scan code for <ExternalLink href={paymentSuccessfulBlockExplorerReceiptLink}>receipt</ExternalLink></span>
      </div>;
      // threeCitiesAdvertisement is an advertisement for the buyer/sender who just completed the payment to use 3cities to accept their own payments. It's only displayed when the computed success action lacks a primary call-to-action
      const threeCitiesAdvertisement = <div className="flex flex-col justify-center items-center">
        <Link to="/" className="text-primary sm:hover:cursor-pointer sm:hover:text-primary-darker">Accept your own payments for free</Link>
      </div>;
      if (isRunningInAStandaloneWindow && checkoutSettings.successAction?.closeWindow !== undefined) return <><div
        className="rounded-md p-3.5 font-medium bg-primary-lighter-2 text-white pointer-events-none w-full text-center"
      >
        {checkoutSettings.successAction.closeWindow.ifStandaloneWindow.callToAction || 'You can close this window now'}
      </div>{largeReceiptQRCode}{threeCitiesAdvertisement}</>;
      else if (isRunningInAnIframe && checkoutSettings.successAction?.closeWindow?.ifIframe?.clickToClose !== undefined) return <><button
        type="button"
        className="rounded-md p-3.5 font-medium bg-primary text-white sm:enabled:hover:bg-primary-darker sm:enabled:hover:cursor-pointer enabled:active:scale-95 w-full"
        onClick={() => closeIframe(checkoutSettings.iframeParentWindowOrigin)}>
        {checkoutSettings.successAction.closeWindow.ifIframe.clickToClose.callToAction || 'Continue'}
      </button>{smallReceiptLink}</>;
      else if (successRedirectOnClick !== undefined) return <><button
        type="button"
        className="rounded-md p-3.5 font-medium bg-primary text-white sm:enabled:hover:bg-primary-darker sm:enabled:hover:cursor-pointer enabled:active:scale-95 w-full"
        onClick={successRedirectOnClick}>
        {checkoutSettings.successAction?.redirect?.callToAction || 'Continue'}
      </button>{smallReceiptLink}</>;
      else if (isRunningInAnIframe && checkoutSettings.successAction?.closeWindow !== undefined && checkoutSettings.successAction.closeWindow.ifIframe.autoClose !== undefined) return <div
        className="rounded-md p-3.5 font-medium bg-primary-lighter-2 text-white pointer-events-none w-full text-center"
      >
        {`Pop-up will close soon`}
      </div>; // here we don't show a receipt link because the iframe will auto close soon, so we don't want user racing to click a receipt link against the auto close 
      else {
        // the success action has not been explicitly computed, so we'll default to providing a button to share payment details
        return <><button
          type="button"
          className="rounded-md p-3.5 font-medium bg-primary text-white sm:enabled:hover:bg-primary-darker sm:enabled:hover:cursor-pointer enabled:active:scale-95 w-full"
          disabled={isPaymentSuccessfulShareCopied} onClick={() => {
            if (canShare) navigator.share(toShare).catch(e => console.warn(e));
            else setIsPaymentSuccessfulShareCopied();
          }}>
          {isPaymentSuccessfulShareCopied ? 'Copied!' : `${canShare ? 'Share' : 'Copy'} Receipt`}
        </button>{largeReceiptQRCode}{threeCitiesAdvertisement}</>;
      }
    })()}
  </div> : undefined;

  return (
    <div className="grid grid-cols-1">
      {paymentScreen}
      {acceptedTokensAndChainsElement}
      {selectPaymentMethodScreen}
      {paymentSuccessfulScreen}
    </div>
  );
} 
