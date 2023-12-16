import { BigNumber } from "@ethersproject/bignumber";
import React, { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { FaEye } from "react-icons/fa";
import { Link } from "react-router-dom";
import useClipboard from "react-use-clipboard";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { CheckoutSettings } from "./CheckoutSettings";
import { CheckoutSettingsRequiresPassword, isCheckoutSettingsRequiresPassword } from "./CheckoutSettingsContext";
import { ConnectWalletButton } from "./ConnectWalletButton";
import { CurrencyAmountInput } from "./CurrencyAmountInput";
import { ExchangeRates, convert } from "./ExchangeRates";
import { Payment, PaymentWithFixedAmount, ProposedPaymentWithFixedAmount, ProposedPaymentWithReceiverAddress, acceptProposedPayment, isPaymentWithFixedAmount, isProposedPaymentWithFixedAmount } from "./Payment";
import { PrimaryWithSecondaries } from "./PrimaryWithSecondaries";
import QRCode from "./QRCode";
import { RenderLogicalAssetAmount, renderLogicalAssetAmount } from "./RenderLogicalAssetAmount";
import { RenderTokenBalance } from "./RenderTokenBalance";
import { RenderTokenTransfer } from "./RenderTokenTransfer";
import { ToggleSwitch } from "./ToggleSwitch";
import { getBlockExplorerUrlForAddress, getBlockExplorerUrlForTransaction } from "./blockExplorerUrls";
import { getChain, getSupportedChainName } from "./chains";
import { formatFloat } from "./formatFloat";
import { LogicalAssetTicker, defaultSmallAmountsPerLogicalAsset, parseLogicalAssetAmount } from "./logicalAssets";
import { getLogicalAssetTickerForTokenOrNativeCurrencyTicker } from "./logicalAssetsToTokens";
import { ProposedStrategy, Strategy, getProposedStrategiesForProposedPayment, getStrategiesForPayment } from "./strategies";
import { TokenTransfer } from "./tokenTransfer";
import { getTokenKey } from "./tokens";
import { ExecuteTokenTransferButton, ExecuteTokenTransferButtonStatus, TransactionFeeUnaffordableError } from "./transactions";
import { truncateEnsName, truncateEthAddress } from "./truncateAddress";
import { useActiveDemoAccount } from "./useActiveDemoAccount";
import { useBestStrategy } from "./useBestStrategy";
import { useCheckoutSettings } from "./useCheckoutSettings";
import { useConnectedAccountContext } from "./useConnectedAccountContext";
import useDebounce from "./useDebounce";
import { useExchangeRates } from "./useExchangeRates";
import { useInitialLoadTimeInSeconds } from "./useInitialLoadTimeInSeconds";
import { useInput } from "./useInput";
import { useLogicalAssetTickerSelectionInput } from "./useLogicalAssetTickerSelectionInput";
import { useProposedPaymentReceiverAddressAndEnsName } from "./useProposedPaymentReceiverAddressAndEnsName";
import { applyVariableSubstitutions } from "./variableSubstitutions";

// TODO support isDynamicPricingEnabled --> eg. add derivedSuggestedPaymentAmounts which calculates suggested amounts when ac finishes loading, and never recalculates them unless page reloads to avoid suggested amount UI jank

// TODO add smart contract wallet protection --> eg. useDoesReceiveAddressSeemSafe(receiverAddress): undefined | { seemsSafe: true, unsafeReason: undefined } | { seemsSafe: false, unsafeReason: 'receiverAddressIsATokenContract', token: Token } | { seemsSafe: false, unsafeReason: 'receiverAddressIsASmartContract', confirmedAcceptedChainIds: [ /* chainIds for which a contract with this address has the same bytecode on the addresses it was detected... ? need to confirm this algorithm with an expert eg. obront */ ] }

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
      if ((payWhatYouWantSelectedSuggestedAmount === undefined || payWhatYouWantSelectedSuggestedAmount === 'other') && payWhatYouWantAmountFromInput !== undefined) return parseLogicalAssetAmount(payWhatYouWantAmountFromInput.toString()).toBigInt(); // here we prioritize payWhatYouWantAmountFromInput as it's defined only if amount input is displayed and user has typed into it, which happens if we're in pay what you want mode AND (there's no suggested amounts OR there are suggested amounts and user picked 'other' to type in amount) --> WARNING must explicitly check for either no suggested amounts or suggested amount set to "other", otherwise a previously typed "other" amount will be used after the user selects a suggested amount because `payWhatYouWantAmountFromInput` is not set back to undefined after deselecting "other"
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
          logicalAssetAmountAsBigNumberHexString: BigNumber.from(payWhatYouWantAmount).toHexString(),
        },
      };
      return derivedPayment;
    } else return undefined;
  }, [checkoutSettings.proposedPayment, receiverAddress, ac, payWhatYouWantSelectedSuggestedAmount, payWhatYouWantAmountFromInput, payWhatYouWantLogicalAssetTickerFromInput]);

  const [status, setStatus] = useState<ExecuteTokenTransferButtonStatus | undefined>(undefined);
  const statusIsError = status?.isError === true; // local var for use as a hook dependency to prevent unnecessary rerenders when this bool goes from undefined to false
  const statusIsSuccess = status?.isSuccess === true; // local var for use as a hook dependency to prevent unnecessary rerenders when this bool goes from undefined to false

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
          amount: BigNumber.from(status.activeTokenTransfer.amountAsBigNumberHexString).toString(),
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

  const sr = status?.reset; // local var to have this useCallback depend only on status.reset
  const doReset = useCallback(() => {
    if (sr) sr();
  }, [sr]);
  // @eslint-no-use-below[sr]

  const errMsgToCopyAnonymized: string = (() => {
    if (status?.isError) {
      const errString = `${status.error} ${JSON.stringify(status.error)}`.replace(checkoutSettings.proposedPayment.receiver.address ? new RegExp(checkoutSettings.proposedPayment.receiver.address, 'gi') : new RegExp(checkoutSettings.proposedPayment.receiver.ensName, 'gi'), `<redacted receiver ${checkoutSettings.proposedPayment.receiver.address ? 'address' : 'ens name'}>`);
      if (connectedAddress === undefined) return errString;
      else return errString.replace(new RegExp(connectedAddress, 'gi'), '<redacted connected wallet address>');
    } else return ' ';
  })();

  const [isErrorCopied, setCopied] = useClipboard(errMsgToCopyAnonymized, {
    successDuration: 10000, // `isErrorCopied` will go back to `false` after 10000ms
  });

  // TODO find a long-term solution instead of this retry button. Or maybe the long-term solution is a more polished retry button?
  const retryButton = useMemo(() => statusIsError ? <div className="grid grid-cols-1 w-full gap-4">
    <div className="mt-4 grid grid-cols-2 w-full gap-4">
      <button className="bg-primary sm:hover:bg-primary-darker sm:hover:cursor-pointer text-white font-bold py-2 px-4 rounded" onClick={doReset}>Retry</button>
      <button className="bg-primary sm:enabled:hover:bg-primary-darker sm:enabled:hover:cursor-pointer text-white font-bold py-2 px-4 rounded" disabled={isErrorCopied} onClick={setCopied}>{isErrorCopied ? 'Copied. DM to @3cities_xyz' : 'Copy Error'}</button>
    </div>
    <span className="text-sm text-center">Please <span className="font-bold text-primary sm:hover:cursor-pointer sm:hover:text-primary-darker" onClick={setCopied}>copy error</span> and<br />paste in a DM to <a href="https://twitter.com/3cities_xyz" target="_blank" rel="noreferrer" className="font-bold text-primary sm:hover:cursor-pointer sm:hover:text-primary-darker">@3cities_xyz</a></span>
  </div> : undefined, [statusIsError, doReset, isErrorCopied, setCopied]);

  const exchangeRates: ExchangeRates | undefined = useExchangeRates();

  const proposedStrategies = useMemo<ProposedStrategy[]>(() => { // WARNING proposedStrategies are computed without considering any connected wallet, and may contain synthetic (non-real) payment amounts for illustrative purposes
    const p = ((): ProposedPaymentWithFixedAmount => {
      const csp = checkoutSettings.proposedPayment;
      if (isProposedPaymentWithFixedAmount(csp)) return csp;
      else return {
        ...csp,
        paymentMode: {
          logicalAssetAmountAsBigNumberHexString: csp.paymentMode.payWhatYouWant.suggestedLogicalAssetAmountsAsBigNumberHexStrings[0] || BigNumber.from(defaultSmallAmountsPerLogicalAsset[csp.logicalAssetTickers.primary]).toHexString(), // WARNING here we fall back to synthetic (non-real, arbitrary) payment amounts for illustrative purposes
        },
      };
    })();
    return getProposedStrategiesForProposedPayment(exchangeRates, checkoutSettings.receiverStrategyPreferences, p);
  }, [checkoutSettings.receiverStrategyPreferences, checkoutSettings.proposedPayment, exchangeRates]);

  const strategies = useMemo<Strategy[] | undefined>(() => {
    if (derivedPaymentWithFixedAmount && ac) return getStrategiesForPayment(exchangeRates, checkoutSettings.receiverStrategyPreferences, derivedPaymentWithFixedAmount, ac);
    else return undefined;
  }, [checkoutSettings.receiverStrategyPreferences, derivedPaymentWithFixedAmount, ac, exchangeRates]);

  const { bestStrategy, otherStrategies, disableAllStrategiesOriginatingFromChainId, selectStrategy } = useBestStrategy(strategies);

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
          <div className="text-xl">Payment Failed (no {getChain(status.activeTokenTransfer.token.chainId)?.nativeCurrency.symbol || 'ETH'} to pay fee)</div>
          <div className="text-lg">Payment method updated</div>
          <div className="text-lg">Please try again</div>
        </div>, {
          duration: 5000,
        });
      }
    }
  }, [strategies, disableAllStrategiesOriginatingFromChainId, status?.error, status?.activeTokenTransfer, status?.buttonClickedAtLeastOnce, userSelectedCurrentStrategy, feeUnaffordableToastDisplayedForCurrentStrategy, setFeeUnaffordableToastDisplayedForCurrentStrategy]);

  const canSelectNewStrategy: boolean = !( // user may select a new strategy (ie payment method) unless...
    (status?.userSignedTransaction // the user signed the transaction
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

  const makeExecuteTokenTransferButton = useCallback((tt: TokenTransfer | undefined, disabled?: true | string) => <div className="relative"><ExecuteTokenTransferButton
    tt={tt}
    autoReset={true}
    loadForeverOnTransactionFeeUnaffordableError={true}
    label="Pay Now"
    successLabel="Paid ✅"
    className="rounded-md p-3.5 font-medium bg-primary sm:enabled:hover:bg-primary-darker focus:outline-none active:scale-95 w-full"
    disabledClassName="text-gray-200 pointer-events-none"
    enabledClassName="text-white"
    errorClassName="text-red-600"
    warningClassName="text-black"
    loadingSpinnerClassName="text-gray-200 fill-primary"
    {...(activeDemoAccount === undefined && { setStatus })}
    {...((activeDemoAccount !== undefined || disabled !== undefined) && { disabled: typeof disabled === 'string' ? disabled : true })}
  />
    {!retryButton && activeDemoAccount && (
      <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-black text-sm whitespace-nowrap text-center">
        disconnect demo<br />account to pay
      </span>
    )}
    {retryButton}
  </div>, [activeDemoAccount, retryButton]);

  const initialLoadTimeInSeconds: number | undefined = useInitialLoadTimeInSeconds([bestStrategy, ac && ac.address === connectedAddress], [checkoutSettings, connectedAddress]);

  const paymentScreen: false | JSX.Element = useMemo(() => !statusIsSuccess && <div className={`${selectingPaymentMethod ? 'hidden' : '' /* WARNING here we hide the payment screen when selecting payment method instead of destroying it. This avoids an ExecuteTokenTransferButton remount each time the payment method changes, which is a mechanism to test reset logic and code paths. */}`}>
    <div className="w-full py-6">
      {(() => {
        const payWhatYouWantAmountHeader = <span className="w-full font-semibold">Select amount to pay</span>;

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
          if (checkoutSettings.proposedPayment.paymentMode.payWhatYouWant !== undefined && checkoutSettings.proposedPayment.paymentMode.payWhatYouWant.suggestedLogicalAssetAmountsAsBigNumberHexStrings.length < 1) return <div>{makePayWhatYouWantAmountUiNoSuggestedAmounts({ includeAmountHeader: true })}{el}</div>; else return el;
        }

        const payWhatYouWantAmountUiWithSuggestedAmounts: JSX.Element = (() => {
          return <>
            <div className="w-full flex flex-col items-center justify-center gap-2 mb-6">
              {payWhatYouWantAmountHeader}
              <div className="w-full flex flex-wrap items-center justify-between gap-6">
                {(checkoutSettings.proposedPayment.paymentMode.payWhatYouWant?.suggestedLogicalAssetAmountsAsBigNumberHexStrings || []).map((a, i) => {
                  const abn: bigint = BigNumber.from(a).toBigInt();
                  return <button
                    key={i}
                    type="button"
                    disabled={payWhatYouWantSelectedSuggestedAmount === abn}
                    className="focus:outline-none rounded-md min-w-[6em] px-2 py-1 font-medium border border-primary enabled:active:scale-95 enabled:bg-white enabled:text-primary sm:enabled:hover:bg-primary sm:enabled:hover:text-white disabled:bg-primary disabled:text-white disabled:cursor-not-allowed"
                    onClick={() => startTransition(() => { // NB wrap this state update in startTransition because it causes strategies to be synchronously regenerated and we want the UI to remain snappy during this process
                      setPayWhatYouWantSelectedSuggestedAmount(abn);
                      setRawPayWhatYouWantAmountFromInput(undefined); // clear any previously set "other" amount so that the next time the user clicks on "other", the old, stale amount isn't still there, which causes UI jank where the old, stale amount is briefly used to generate a strategy pipeline before the newly mounted CurrencyAmountInput sets it to undefined
                    })}
                  >
                    <RenderLogicalAssetAmount
                      logicalAssetTicker={checkoutSettings.proposedPayment.logicalAssetTickers.primary /* suggested amounts always use the original logical asset ticker, or else the suggested amount denominations would change when the sender selects a different logical asset during 'Other' */}
                      amountAsBigNumberHexString={a}
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
            if (checkoutSettings.proposedPayment.paymentMode.payWhatYouWant.suggestedLogicalAssetAmountsAsBigNumberHexStrings.length < 1) return <div>{makePayWhatYouWantAmountUiNoSuggestedAmounts({ includeAmountHeader: true })}{el}</div>;
            else return <div>{payWhatYouWantAmountUiWithSuggestedAmounts}{el}</div>;
          } else return el;
        }

        if (!isConnected) return <ConnectWalletButton disconnectedLabel="Connect Wallet to Pay" />; // TODO replace this with ConnectWalletButtonCustom where the styling props passed are from local variables shared with ExecuteTokenTransferButton. This ensures the styles of the two buttons are exactly the same (whereas today, they are only coincidentally the same), preventing UI jank after connecting wallet
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
            Connected wallet has no payment options
          </button>);
          case 'receiverAddressLoading': return maybeMakePayWhatYouWantAmountUiNoSuggestedAmounts(makeExecuteTokenTransferButton(undefined));
          case 'senderAddressContextLoading': return maybeMakePayWhatYouWantAmountUiNoSuggestedAmounts(makeExecuteTokenTransferButton(undefined));
          case 'senderMustSpecifyFixedAmount': return maybeMakePayWhatYouWantAmountUiMaybeWithSuggestedAmounts(makeExecuteTokenTransferButton(undefined, 'Pay Now'));
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
            <span>{!showFullReceiverAddress && (truncateEnsName(receiverEnsName) || truncateEthAddress(receiverAddress))}{showFullReceiverAddress && receiverAddress && `${receiverAddress}${receiverEnsName ? ` (${receiverEnsName})` : ''}`}{showFullReceiverAddress && !receiverAddress && receiverEnsName}{showFullReceiverAddress && receiverAddressBlockExplorerLink && <a href={receiverAddressBlockExplorerLink} target="_blank" rel="noreferrer" className="font-bold text-primary sm:hover:cursor-pointer sm:hover:text-primary-darker ml-1">explorer</a>}</span>
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
            amountAsBigNumberHexString={fixedPayment.paymentMode.logicalAssetAmountAsBigNumberHexString}
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
                  const paymentAmountInMostRelevantSecondaryLat: bigint | undefined = convert({ er: exchangeRates, fromTicker: 'USD', toTicker: mostRelevantSecondaryLat, fromAmount: BigNumber.from(fixedPayment.paymentMode.logicalAssetAmountAsBigNumberHexString).toBigInt() });
                  if (paymentAmountInMostRelevantSecondaryLat !== undefined) return {
                    lat: mostRelevantSecondaryLat,
                    amount: paymentAmountInMostRelevantSecondaryLat,
                  }; else return 'preserve space'; // here we 'preserve space' because the most likely reason that paymentAmountInMostRelevantSecondaryLat is undefined is because exchange rates are initially loading, so we don't want to collapse the space now only to have it un-collapse after rates finish loading and cause UI jank
                } else return 'collapse space'; // no relevant non-USD secondary lat was found and one is unlikely to be automatically found soon, so we collapse space to avoid the ugly blank space
              } else { // the payment's primary logical asset is not USD, so we always show the USD equivalent (see note above on our asymmetric bias for USD)
                const usdAmount: bigint | undefined = convert({ er: exchangeRates, fromTicker: fixedPayment.logicalAssetTickers.primary, toTicker: 'USD', fromAmount: BigNumber.from(fixedPayment.paymentMode.logicalAssetAmountAsBigNumberHexString).toBigInt() });
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
                amountAsBigNumberHexString={BigNumber.from(otherLogicalAssetAmountToDisplay.amount).toHexString()}
              /> : <span>&nbsp;</span>}</span>
            </> : undefined;
          })()}
        </div>}
      </>;
    })()}
    {isConnected && /* WARNING here render payment method section only if isConnected as a render optimization because when disconnecting the wallet, bestStrategy does not become undefined until event callbacks clear the ExecuteTokenTransferButton status because bestStrategy is computed using status.activeTokenTransfer. So here, we don't render Payment Method if disconnected to avoid briefly rendering it with a stale bestStrategy after wallet becomes disconnected */ bestStrategy !== undefined && <div className="mt-6 w-full">
      <div className="font-bold text-lg">Payment method</div>
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
            className="relative flex-0 rounded-md px-2 py-0.5 mr-2 bg-gray-200 sm:hover:bg-gray-300 focus:outline-none active:scale-95"
            type="button"
          >
            change
          </button></span>}
        </div>
        <span className="text-gray-500 text-xs">{(otherStrategies || []).length + 1 /* + 1 because we count the current bestStrategy among the methods */} payment method{(otherStrategies || []).length > 0 ? 's' : ''} across {[... new Set((strategies || []).map(s => s.tokenTransfer.token.chainId))].length} chain{[... new Set((strategies || []).map(s => s.tokenTransfer.token.chainId))].length > 1 ? 's' : ''} {initialLoadTimeInSeconds ? <span>({formatFloat(initialLoadTimeInSeconds, 2)} seconds)</span> : undefined}</span>
      </div>
    </div>}
  </div>, [startTransition, isConnected, checkoutSettings.note, checkoutSettings.proposedPayment.logicalAssetTickers.primary, checkoutSettings.proposedPayment.paymentMode.payWhatYouWant, proposedPaymentWithFixedAmount, receiverAddress, receiverAddressBlockExplorerLink, receiverEnsName, payWhatYouWantSelectedSuggestedAmount, setPayWhatYouWantSelectedSuggestedAmount, setRawPayWhatYouWantAmountFromInput, payWhatYouWantLogicalAssetTickerFromInput, payWhatYouWantLogicalAssetTickerSelectionInputElement, derivedPaymentWithFixedAmount, exchangeRates, proposedStrategies, strategies, bestStrategy, otherStrategies, canSelectNewStrategy, checkoutReadinessState, makeExecuteTokenTransferButton, showFullReceiverAddress, status?.activeTokenTransfer, statusIsSuccess, selectingPaymentMethod, initialLoadTimeInSeconds]);

  const acceptedTokensAndChainsElement: false | JSX.Element = useMemo(() => !statusIsSuccess // NB here we must check statusIsSuccess because the sender may have no payment options after successful payment (eg. if they paid using their only payment method and it was exhausted by the payment) and so `checkoutReadinessState === 'senderHasNoPaymentOptions'` may be true after paying
    && checkoutReadinessState === 'senderHasNoPaymentOptions' && <div className="w-full">
      {(() => {
        const allStrategiesTokenTickers: string[] = [... new Set(proposedStrategies.map(ps => ps.proposedTokenTransfer.token.ticker))];
        const allStrategiesChainIds: number[] = [... new Set(proposedStrategies.map(ps => ps.proposedTokenTransfer.token.chainId))];
        return <>
          <div className="pt-6 font-bold text-lg">Tokens accepted</div>
          <div className="mt-2 p-4 border border-gray-300 bg-white rounded-md">{allStrategiesTokenTickers.join(", ")}</div>
          <div className="pt-6 font-bold text-lg">Chains accepted</div>
          <div className="mt-2 p-4 border border-gray-300 bg-white rounded-md">{allStrategiesChainIds.map(getSupportedChainName).join(", ")}</div>
        </>;
      })()}
    </div>, [statusIsSuccess, checkoutReadinessState, proposedStrategies]);

  // TODO update acceptedTokensAndChainsSummaryElement to stop using "Instantly..." language and start using a summary of tokens and chains similar to acceptedTokensAndChainsElement but in a single payment method box
  const acceptedTokensAndChainsSummaryElement: false | JSX.Element = useMemo(() => !statusIsSuccess // NB here we must check statusIsSuccess because success status may be preserved even if the sender disconnects their wallet after successful payment, so `!isConnected` may be true after successful payment
    && !isConnected && <div className="mt-6 w-full">
      {(() => {
        const allProposedStrategiesTokenTickers: string[] = [... new Set(proposedStrategies.map(ps => ps.proposedTokenTransfer.token.ticker))];
        const allProposedStrategiesChainIds: number[] = [... new Set(proposedStrategies.map(ps => ps.proposedTokenTransfer.token.chainId))];
        return <>
          <div className="font-bold text-lg">Payment method</div>
          <div className="mt-2 p-4 border border-gray-300 bg-white rounded-md">{allProposedStrategiesTokenTickers.length} token{allProposedStrategiesTokenTickers.length > 1 ? 's' : ''} across {allProposedStrategiesChainIds.length} chain{allProposedStrategiesChainIds.length > 1 ? 's' : ''} accepted by this payment</div>
        </>;
      })()}
    </div>, [isConnected, statusIsSuccess, proposedStrategies]);

  const selectPaymentMethodScreen: false | JSX.Element = useMemo(() => bestStrategy !== undefined && otherStrategies !== undefined && otherStrategies.length > 0 && <div className={`grid grid-cols-1 w-full items-center py-6 ${selectingPaymentMethod ? '' : 'hidden'}`}>
    <div className="font-bold text-2xl">Select a payment method</div>
    <div className="my-2 flex items-end justify-between">
      <div className="font-bold text-lg">Pay with</div>
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
  </div>, [ac, strategies, bestStrategy, otherStrategies, canSelectNewStrategy, selectStrategy, selectingPaymentMethod, wantToSetSelectingPaymentMethodToFalse, setWantToSetSelectingPaymentMethodToFalse]);

  const paymentSuccessfulBlockExplorerReceiptLink: string | undefined = (() => {
    if (!status?.isSuccess) return undefined;
    else return getBlockExplorerUrlForTransaction(status.activeTokenTransfer.token.chainId, status.successData.transactionHash);
  })();

  // NB when using redirect URLs and webhooks, there are at least three reasonable ways to help a receiver/seller distinguish distinct senders/buyers using the same pay link: 1. pass-through url params, 2. checkoutSettings.reference, 3. embedded pay link using iframe message passing to receive the host page url and including it here (and then the host page url would need to have uniquely identifiable information for the distinct sender/buyer). And if the receiver/seller uses one pay link per buyer, the seller can then store the pay links in a DB and we can submit the pay link.

  const successRedirectOnClick: (() => void) | undefined = useMemo(() => { // successRedirectOnClick is defined iff the payment has been successful and a redirect now needs to be executed, in which case successRedirectOnClick itself is the onClick function for a button executing this redirect
    if (statusIsSuccess && checkoutSettings.successRedirect) {
      const srd = checkoutSettings.successRedirect;
      const urlWithVariableSubstitutions = applyVariableSubstitutions(srd.url, {
        R: encodeURIComponent(paymentSuccessfulBlockExplorerReceiptLink || ''),
      });
      return () => { // TODO support pass-through url params where arbitrary url params on the pay link are auto-forwarded to the redirect url
        if (srd.openInNewTab) window.open(urlWithVariableSubstitutions, '_blank');
        else window.location.href = urlWithVariableSubstitutions;
      };
    } else return undefined;
  }, [checkoutSettings.successRedirect, statusIsSuccess, paymentSuccessfulBlockExplorerReceiptLink]);

  const paymentSuccessfulBaseText: string = (() => {
    if (derivedPaymentWithFixedAmount && status?.isSuccess) {
      return `Hey, I paid you ${renderLogicalAssetAmount({
        logicalAssetTicker: derivedPaymentWithFixedAmount.logicalAssetTickers.primary,
        amountAsBigNumberHexString: derivedPaymentWithFixedAmount.paymentMode.logicalAssetAmountAsBigNumberHexString,
      })}${checkoutSettings.note ? ` for ${checkoutSettings.note}` : ''} using 3cities.xyz`;
    } else return ' ';
  })();

  const paymentSuccessfulTextNoLinkToShare: string = (() => {
    if (status?.isSuccess) {
      const computedReceiptWithoutLink = paymentSuccessfulBlockExplorerReceiptLink ? `` : ` Payment transaction hash: ${status.successData.transactionHash} on ${getSupportedChainName(status.activeTokenTransfer.token.chainId)}`; // the idea here is that we'll include the verbose "Transaction hash ..." as a "manual non-link receipt" iff the actual payment receipt link couldn't be constructed. This provides a fallback while avoiding including the spammy "transaction hash" text in the case where link is available.
      return `${paymentSuccessfulBaseText}${computedReceiptWithoutLink}`;
    } else return ' ';
  })();

  const paymentSuccessfulTextWithLinkToShare: string = (() => {
    if (status?.isSuccess) {
      const computedReceipt = paymentSuccessfulBlockExplorerReceiptLink ? `Receipt: ${paymentSuccessfulBlockExplorerReceiptLink}` : `Payment transaction hash: ${status.successData.transactionHash} on ${getSupportedChainName(status.activeTokenTransfer.token.chainId)}`;
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
      Payment Successful ✅
    </button>
    {successRedirectOnClick !== undefined ? <button
      type="button"
      className="rounded-md p-3.5 font-medium bg-primary text-white sm:enabled:hover:bg-primary-darker sm:enabled:hover:cursor-pointer w-full"
      onClick={successRedirectOnClick}>
      {checkoutSettings.successRedirect?.callToAction || 'Continue'}
    </button> : <button
      type="button"
      className="rounded-md p-3.5 font-medium bg-primary text-white sm:enabled:hover:bg-primary-darker sm:enabled:hover:cursor-pointer w-full"
      disabled={isPaymentSuccessfulShareCopied} onClick={() => {
        if (canShare) navigator.share(toShare).catch(e => console.warn(e));
        else setIsPaymentSuccessfulShareCopied();
      }}>
      {isPaymentSuccessfulShareCopied ? 'Copied!' : `${canShare ? 'Share' : 'Copy'} Receipt`}
    </button>}
    {paymentSuccessfulBlockExplorerReceiptLink && <div className="flex flex-col justify-center items-center gap-2">
      <QRCode data={paymentSuccessfulBlockExplorerReceiptLink} />
      <span>Scan code for <a href={paymentSuccessfulBlockExplorerReceiptLink} target="_blank" rel="noopener noreferrer" className="text-primary sm:hover:text-primary-darker sm:hover:cursor-pointer"> receipt</a></span>
    </div>}
    {/* here we hide the "Send a new Pay Link" button only if a redirect call-to-action exists because we don't want to distract users away from completing the redirect */ successRedirectOnClick === undefined ? <div className="grid grid-cols-1 w-full items-center gap-4">
      <Link to="/pay-link">
        <button
          type="button"
          className="rounded-md p-3.5 font-medium bg-primary text-white sm:hover:bg-primary-darker sm:hover:cursor-pointer w-full">
          Send a new Pay Link
        </button>
      </Link>
    </div> : undefined}

  </div> : undefined;

  return (
    <div className="grid grid-cols-1">
      {paymentScreen}
      {acceptedTokensAndChainsElement}
      {acceptedTokensAndChainsSummaryElement}
      {selectPaymentMethodScreen}
      {paymentSuccessfulScreen}
    </div>
  );
} 
