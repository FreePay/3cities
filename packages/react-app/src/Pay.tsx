import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaEye } from "react-icons/fa";
import { Link } from "react-router-dom";
import useClipboard from "react-use-clipboard";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { CheckoutSettings } from "./CheckoutSettings";
import { CheckoutSettingsRequiresPassword, isCheckoutSettingsRequiresPassword } from "./CheckoutSettingsContext";
import { ConnectWalletButton } from "./ConnectWalletButton";
import { Payment, ProposedPaymentWithFixedAmount, ProposedPaymentWithReceiverAddress, acceptProposedPayment, isProposedPaymentWithFixedAmount } from "./Payment";
import QRCode from "./QRCode";
import { RenderLogicalAssetAmount, renderLogicalAssetAmount } from "./RenderLogicalAssetAmount";
import { RenderTokenBalance } from "./RenderTokenBalance";
import { RenderTokenTransfer } from "./RenderTokenTransfer";
import { ToggleSwitch } from "./ToggleSwitch";
import { getBlockExplorerUrlForAddress, getBlockExplorerUrlForTransaction } from "./blockExplorerUrls";
import { getChain, getSupportedChainName } from "./chains";
import { Strategy, getProposedStrategiesForProposedPayment, getStrategiesForPayment } from "./strategies";
import { TokenTransfer } from "./tokenTransfer";
import { getTokenKey } from "./tokens";
import { ExecuteTokenTransferButton, ExecuteTokenTransferButtonStatus, TransactionFeeUnaffordableError } from "./transactions";
import { truncateEnsAddress, truncateEthAddress } from "./truncateAddress";
import { useActiveDemoAccount } from "./useActiveDemoAccount";
import { useBestStrategy } from "./useBestStrategy";
import { useCheckoutSettings } from "./useCheckoutSettings";
import { useConnectedAccountContext } from "./useConnectedAccountContext";
import { useInput } from "./useInput";
import { useProposedPaymentReceiverAddressAndEnsName } from "./useProposedPaymentReceiverAddressAndEnsName";

// TODO add a big "continue" button at bottom of "select payment method" because if you don't want to change the method, it's unclear that you have to click on the current method. --> see the "continue" button at bottom of Amazon's payment method selection during mobile checkout.

// TODO support Payment.paymentMode.PayWhatYouWant. A design idea to here is for the root Payment (with pay what you want mode) to be passed into getStrategiesForPayment normally, and for getStrategiesForPayment to take a new parameter indicating the buyer's preferences of what they want to pay, and then during strategy generation, derived/synthetic Payment(s) are generated in fixed amounts and those synthetic payments are recursively fed into getStrategiesForPayment, and the resulting strategies for all synthetic payments are returned as a single collection. This takes advantage of the fact that Strategy.payment does not have to be the root payment, ie. the strategies can have a diversity of payments. --> a possible scenario to handle is that today, when the sender's wallet is disconnected, we display the accepted tokens and chains by extracting them from proposed strategies, so we'd want to ensure that proposed strategies for "pay what you want" mode still facilitate this, which can be done by eg. defaulting to synthetic payments craeted created from PayWhatYouWant.suggestedLogicalAssetAmountsAsBigNumberHexStrings and if that's empty, a default list of suggetsed amounts. --> WARNING when refactoring the code to support "pay what you want mode", we'll have to handle the fact that some Pay features assume that the passed proposedPayment is the same payment that ended up being settled for this checkout, but that assumption is no longer true in "pay what you want mode". For example, paymentSuccessfulBaseText extracts the logical amount from proposedPayment, but during "pay what you want mode", the logical amount paid will depend on which synthetic payment was chosen for settlement.

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
      timerId = setTimeout(() => setIsPasswordIncorrect(true), 250);
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

type PayInnerProps = {
  checkoutSettings: CheckoutSettings;
}

const PayInner: React.FC<PayInnerProps> = ({ checkoutSettings }) => {
  const { isConnected, address: connectedAddress } = useAccount();

  const proposedPaymentWithFixedAmount: ProposedPaymentWithFixedAmount = (() => { // NB no useMemo is needed here because we are copying checkoutSettings.proposedPayment into proposedPaymentWithFixedAmount and this object reference is stable across renders because checkoutSettings is stable across renders
    if (isProposedPaymentWithFixedAmount(checkoutSettings.proposedPayment)) return checkoutSettings.proposedPayment;
    else throw new Error("unexpected proposed payment with 'pay what you want' mode"); // TODO support 'pay what you want' mode
  })();

  const { receiverAddress, receiverEnsName, receiverAddressIsLoading } = useProposedPaymentReceiverAddressAndEnsName(checkoutSettings.proposedPayment);

  const proposedPaymentWithReceiverAddress = useMemo<ProposedPaymentWithReceiverAddress | undefined>(() => {
    if (receiverAddress === undefined) return undefined;
    else return Object.assign({}, checkoutSettings.proposedPayment, {
      receiver: { address: receiverAddress },
    });
  }, [checkoutSettings.proposedPayment, receiverAddress]);

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

  const payment = useMemo<Payment | undefined>(() => proposedPaymentWithReceiverAddress && ac && acceptProposedPayment(ac.address, proposedPaymentWithReceiverAddress), [ac, proposedPaymentWithReceiverAddress]);

  const [status, setStatus] = useState<ExecuteTokenTransferButtonStatus | undefined>(undefined);
  const statusIsError = status?.isError === true; // local var for use as a hook dependency to prevent unnecessary rerenders when this bool goes from undefined to false
  const statusIsSuccess = status?.isSuccess === true; // local var for use as a hook dependency to prevent unnecessary rerenders when this bool goes from undefined to false

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

  const strategies = useMemo<Strategy[] | undefined>(() => {
    if (payment && ac) return getStrategiesForPayment(checkoutSettings.receiverStrategyPreferences, payment, ac);
    else return undefined;
  }, [checkoutSettings.receiverStrategyPreferences, payment, ac]);

  const { bestStrategy, otherStrategies, disableStrategy, selectStrategy } = useBestStrategy(strategies);

  const receiverAddressBlockExplorerLink: string | undefined = (() => {
    if (proposedPaymentWithReceiverAddress) return getBlockExplorerUrlForAddress((status?.activeTokenTransfer || bestStrategy?.tokenTransfer)?.token.chainId, proposedPaymentWithReceiverAddress.receiver.address);
    else return undefined;
  })();

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
      // here, the user can't afford to pay the transaction fee for the active token transfer, so we'll disable the strategy. We'll also disable all other strategies for the same chainId under the assumption that if the user can't afford this strategy, they can't afford any other strategies on that same chain. WARNING this assumption is untrue in the case where a user can't afford an erc20 transfer but could afford the cheaper native currency transfer.
      strategies.forEach(s => {
        if (s.tokenTransfer.token.chainId === status.activeTokenTransfer.token.chainId) disableStrategy(s);
      });
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
  }, [strategies, disableStrategy, status?.error, status?.activeTokenTransfer, status?.buttonClickedAtLeastOnce, userSelectedCurrentStrategy, feeUnaffordableToastDisplayedForCurrentStrategy, setFeeUnaffordableToastDisplayedForCurrentStrategy]);

  const canSelectNewStrategy: boolean = !( // user may select a new strategy (ie payment method) unless...
    (status?.userSignedTransaction // the user signed the transaction
      || status?.userIsSigningTransaction) // or the user is currently signing the transaction
    && !status.isError // and there wasn't an error, then we don't want to let the user select a new strategy because they may broadcast a successful transaction for the current transfer, and that could result in a double-spend for this Agreement (eg. the user selects a new strategy, then signs the transaction for the previous strategy, then signs a transaction for the new strategy, and there's a double spend)
  );

  const [selectingPaymentMethod, setSelectingPaymentMethod] = useState(false); // layout control variable to determine if payment method selection view is being shown. We use this instead of handling payment method selection at the route level because there's a lot of accumulated state in this page that I didn't want to (and wasn't sure how to be) split across routes. This means payment method selection doesn't result in changing the URL, so you can't link to payment method selection, you can only open it up once the link is loaded, which is fine.

  useEffect(() => {
    if (selectingPaymentMethod // if the user is selecting a payment method
      && (
        !canSelectNewStrategy // but state updates and they can no longer select a new strategy
        || otherStrategies === undefined // or if state updates and there's no longer any other payment methods to select
        || otherStrategies.length < 1
      )
    ) setSelectingPaymentMethod(false); // then we'll close the payment select view
  }, [setSelectingPaymentMethod, selectingPaymentMethod, canSelectNewStrategy, otherStrategies]);

  const checkoutReadinessState:
    'receiverAddressLoading' // the CheckoutSettings.proposedPayment used an ens name for the receiver, and resolving this ens name into an address is in progress
    | 'receiverAddressCouldNotBeDetermined' // the CheckoutSettings.proposedPayment used an ens name for the receiver, and resolving this ens name into an address failed
    | 'senderAccountNotConnected' // ie. this page is has no wallet connected
    | 'senderAddressContextLoading' // this page has a wallet connected, but the connected wallet's AddressContext is still loading
    | 'senderHasNoPaymentOptions' // based on the connected wallet's address context, the sender has no payment options
    | 'ready'
    = (() => {
      if (receiverAddressIsLoading) return 'receiverAddressLoading';
      else if (receiverAddress === undefined) return 'receiverAddressCouldNotBeDetermined';
      else if (!isConnected) return 'senderAccountNotConnected';
      else if (ac === undefined || (bestStrategy === undefined && isDuringConnectedAccountContextInitialLoadGracePeriod)) return 'senderAddressContextLoading';
      else if (ac !== undefined && bestStrategy === undefined) return 'senderHasNoPaymentOptions';
      else return 'ready';
    })();

  const activeDemoAccount: string | undefined = useActiveDemoAccount();

  const makeExecuteTokenTransferButton = useCallback((tt: TokenTransfer | undefined) => <div className="relative"><ExecuteTokenTransferButton
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
    {...(activeDemoAccount !== undefined && { disabled: true })}
  />
    {!retryButton && activeDemoAccount && (
      <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-tertiary-darker-2 text-sm whitespace-nowrap text-center">
        disabled when<br />impersonating
      </span>
    )}
    {retryButton}
  </div>, [activeDemoAccount, retryButton]);

  const paymentScreen: false | JSX.Element = useMemo(() => !statusIsSuccess && <div className={`${selectingPaymentMethod ? 'hidden' : '' /* WARNING here we hide the payment screen when selecting payment method instead of destroying it. This avoids an ExecuteTokenTransferButton remount each time the payment method changes, which is a mechanism to test reset logic and code paths. */}`}>
    <div className="w-full py-6">
      {(() => {
        if (!isConnected) return <ConnectWalletButton disconnectedLabel="Connect Wallet to Pay" />; // TODO replace this with ConnectWalletButtonCustom where the styling props passed are from local variables shared with ExecuteTokenTransferButton. This ensures the styles of the two buttons are exactly the same (whereas today, they are only coincidentally the same), preventing UI jank after connecting wallet
        else switch (checkoutReadinessState) {
          case 'receiverAddressCouldNotBeDetermined': return <button
            type="button"
            className="rounded-md p-3.5 bg-tertiary text-black pointer-events-none w-full"
          >
            Receiver ENS name has no address
          </button>
          case 'senderAccountNotConnected': throw new Error("expected checkoutReadinessState to not be receiverAddressReadyButSenderAccountNotConnected when sender account is connected"); // here we never expect receiverAddressReadyButSenderAccountNotConnected because this switch statement is `else isConnected`
          case 'senderHasNoPaymentOptions': return <button
            type="button"
            className="rounded-md p-3.5 bg-tertiary text-black pointer-events-none w-full"
          >
            Connected wallet has no payment options
          </button>;
          case 'receiverAddressLoading': return makeExecuteTokenTransferButton(undefined);
          case 'senderAddressContextLoading': return makeExecuteTokenTransferButton(undefined);
          case 'ready': if (bestStrategy === undefined) throw new Error("expected bestStrategy to be defined when checkoutReadinessState is 'ready'"); else return makeExecuteTokenTransferButton(bestStrategy.tokenTransfer);
        }
      })()}
    </div>
    <div className="p-4 flex items-center gap-4 justify-between w-full border border-gray-300 bg-white rounded-t-md">
      <span>To:</span>
      <span className="font-bold inline-flex gap-1 place-content-between" style={{ overflowWrap: 'anywhere' }}>
        <span>{!showFullReceiverAddress && (truncateEnsAddress(receiverEnsName) || truncateEthAddress(receiverAddress))}{showFullReceiverAddress && receiverAddress && `${receiverAddress}${receiverEnsName ? ` (${receiverEnsName})` : ''}`}{showFullReceiverAddress && !receiverAddress && receiverEnsName}{showFullReceiverAddress && receiverAddressBlockExplorerLink && <a href={receiverAddressBlockExplorerLink} target="_blank" rel="noreferrer" className="font-bold text-primary sm:hover:cursor-pointer sm:hover:text-primary-darker ml-1">explorer</a>}</span>
        <span className="flex place-items-center"><FaEye onClick={() => setShowFullReceiverAddress(v => !v)} className="w-4 sm:hover:text-gray-500 sm:hover:cursor-pointer" /></span>
      </span>
    </div>
    {checkoutSettings.note !== undefined && <div className="p-4 flex items-center w-full border-b border-x border-gray-300 bg-white">
      <span className="text-left">{checkoutSettings.note}</span>
    </div>}
    <div className="p-4 grid grid-cols-2 w-full border-b border-x border-gray-300 bg-white rounded-b-md">
      <span className="font-bold text-lg">Total:</span>
      <span className="font-bold text-lg text-right"><RenderLogicalAssetAmount
        logicalAssetTicker={proposedPaymentWithFixedAmount.logicalAssetTicker}
        amountAsBigNumberHexString={proposedPaymentWithFixedAmount.paymentMode.logicalAssetAmountAsBigNumberHexString}
        showAllZeroesAfterDecimal={true}
      /></span>
    </div>
    {bestStrategy !== undefined && <div className="py-4 w-full">
      <div className="font-bold text-lg">Payment method</div>
      <div className="p-2 border border-gray-300 bg-white rounded-b-md flex flex-wrap gap-y-2 justify-between items-center">
        <RenderTokenTransfer tt={status?.activeTokenTransfer || bestStrategy.tokenTransfer} opts={{ hideAmount: true }} />
        {canSelectNewStrategy && otherStrategies && otherStrategies.length > 0 && <span className="text-xs"><button
          onClick={() => setSelectingPaymentMethod(true)}
          className="relative flex-0 rounded-md px-2 py-0.5 mx-2 bg-gray-200 sm:hover:bg-gray-300 focus:outline-none active:scale-95"
          type="button"
        >
          change
        </button>({otherStrategies.length + 1 /* + 1 because we count the current bestStrategy among the methods */} payment methods)</span>}
      </div>
    </div>}
  </div>, [isConnected, checkoutSettings.note, proposedPaymentWithFixedAmount.logicalAssetTicker, proposedPaymentWithFixedAmount.paymentMode.logicalAssetAmountAsBigNumberHexString, receiverAddress, receiverAddressBlockExplorerLink, receiverEnsName, bestStrategy, otherStrategies, canSelectNewStrategy, checkoutReadinessState, makeExecuteTokenTransferButton, showFullReceiverAddress, status?.activeTokenTransfer, statusIsSuccess, selectingPaymentMethod]);

  const acceptedTokensAndChainsBox: false | JSX.Element = useMemo(() => checkoutReadinessState === 'senderHasNoPaymentOptions' && <div className="w-full">
    {(() => {
      const pss = getProposedStrategiesForProposedPayment(checkoutSettings.receiverStrategyPreferences, checkoutSettings.proposedPayment);
      const allStrategiesTokenTickers: string[] = [... new Set(pss.map(ps => ps.proposedTokenTransfer.token.ticker))];
      const allStrategiesChainIds: number[] = [... new Set(pss.map(ps => ps.proposedTokenTransfer.token.chainId))];
      return <>
        <div className="pt-4 font-bold text-lg">Tokens accepted</div>
        <div className="p-2 border border-gray-300 bg-white rounded-b-md">{allStrategiesTokenTickers.join(", ")}</div>
        <div className="pt-4 font-bold text-lg">Chains accepted</div>
        <div className="p-2 border border-gray-300 bg-white rounded-b-md">{allStrategiesChainIds.map(getSupportedChainName).join(", ")}</div>
      </>;
    })()}
  </div>, [checkoutSettings.receiverStrategyPreferences, checkoutSettings.proposedPayment, checkoutReadinessState]);

  const selectPaymentMethodScreen: false | JSX.Element = useMemo(() => bestStrategy !== undefined && otherStrategies !== undefined && otherStrategies.length > 0 && <div className={`grid grid-cols-1 w-full items-center py-6 ${selectingPaymentMethod ? '' : 'hidden'}`}>
    <div className="font-bold text-2xl">Select a payment method</div>
    <div className="py-2 flex items-end justify-between">
      <div className="font-bold text-lg">Pay with</div>
      <div className="font-bold text-sm">Your balance</div>
    </div>
    {[bestStrategy, ...otherStrategies].map((s, i) => {
      const tk = getTokenKey(s.tokenTransfer.token);
      const tb = ac?.tokenBalances[tk];
      return <div key={tk}
        className={`flex gap-2 justify-between p-2 ${i > 1 ? 'border-t' : ''} ${i > 0 ? 'border-x' : ''} ${i === 0 ? 'border-2 border-secondary' : 'border-gray-300'} bg-white ${i === otherStrategies.length /* NB absence of -1 because array is one longer due to prepend of bestStrategy */ ? 'border-b' : ''} ${i === 0 ? 'rounded-t-md' : ''} ${i === otherStrategies.length /* NB absence of -1 because array is one longer due to prepend of bestStrategy */ ? 'rounded-b-md' : ''} sm:hover:cursor-pointer focus:outline-none active:scale-95 sm:hover:bg-gray-200`}
        onClick={() => {
          if (i > 0 && canSelectNewStrategy) {
            selectStrategy(s);
            setNextStrategyWasSelectedByTheUser(true);
            // WARNING here we must not call status.reset() because canSelectNewStrategy is intended to be true iff autoReset=true will auto-reset the button. If instead we called reset here, and there was some state inconsistency between our view and the button's view of the transfer, then it's possible that we might reset the button after it's unsafe to do so (eg. when user may sign a tx for the old transfer) and risk causing a double payment.
          }
          setSelectingPaymentMethod(false);
        }}>
        <span>
          <RenderTokenTransfer tt={s.tokenTransfer} opts={{ hideAmount: true }} />
        </span>
        {ac !== undefined && tb && <span className="text-right"> <RenderTokenBalance tb={tb} opts={{ hideChainSeparator: true, hideChain: true }} /></span>}
      </div>
    })}
  </div>, [ac, bestStrategy, otherStrategies, canSelectNewStrategy, selectStrategy, selectingPaymentMethod]);

  const paymentSuccessfulBlockExplorerReceiptLink: string | undefined = (() => {
    if (!status?.isSuccess) return undefined;
    else return getBlockExplorerUrlForTransaction(status.activeTokenTransfer.token.chainId, status.successData.transactionHash);
  })();

  const paymentSuccessfulBaseText: string = (() => {
    if (status?.isSuccess) {
      return `Hey, I paid you ${renderLogicalAssetAmount({
        logicalAssetTicker: proposedPaymentWithFixedAmount.logicalAssetTicker,
        amountAsBigNumberHexString: proposedPaymentWithFixedAmount.paymentMode.logicalAssetAmountAsBigNumberHexString,
        showAllZeroesAfterDecimal: true,
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
    <button
      type="button"
      className="rounded-md p-3.5 font-medium bg-primary text-white sm:enabled:hover:bg-primary-darker sm:enabled:hover:cursor-pointer w-full"
      disabled={isPaymentSuccessfulShareCopied} onClick={() => {
        if (canShare) navigator.share(toShare).catch(e => console.warn(e));
        else setIsPaymentSuccessfulShareCopied();
      }}>
      {isPaymentSuccessfulShareCopied ? 'Copied!' : `${canShare ? 'Share' : 'Copy'} Receipt`}
    </button>
    {paymentSuccessfulBlockExplorerReceiptLink && <div className="flex flex-col justify-center items-center gap-2">
      <QRCode data={paymentSuccessfulBlockExplorerReceiptLink} />
      <span>Scan code for <a href={paymentSuccessfulBlockExplorerReceiptLink} target="_blank" rel="noopener noreferrer" className="text-primary sm:hover:text-primary-darker sm:hover:cursor-pointer"> receipt</a></span>
    </div>}
    <div className="grid grid-cols-1 w-full items-center gap-4">
      <Link to="/pay-link">
        <button
          type="button"
          className="rounded-md p-3.5 font-medium bg-primary text-white sm:hover:bg-primary-darker sm:hover:cursor-pointer w-full">
          Send a new Pay Link
        </button>
      </Link>
    </div>

  </div> : undefined;

  return (
    <div className="grid grid-cols-1">
      {paymentScreen}
      {acceptedTokensAndChainsBox}
      {selectPaymentMethodScreen}
      {paymentSuccessfulScreen}
    </div>
  );
} 
