import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FaEye } from "react-icons/fa";
import { Link, useSearchParams } from "react-router-dom";
import useClipboard from "react-use-clipboard";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { ActiveDemoAccountContext } from "./ActiveDemoAccountContext";
import { ConnectWalletButton } from "./ConnectWalletButton";
import QRCode from "./QRCode";
import { RenderLogicalAssetAmount, renderLogicalAssetAmount } from "./RenderLogicalAssetAmount";
import { RenderTokenBalance } from "./RenderTokenBalance";
import { RenderTokenTransfer } from "./RenderTokenTransfer";
import { ReceiverProposedPayment, acceptReceiverProposedPayment, isReceiverProposedPayment } from "./agreements";
import { getBlockExplorerUrlForAddress, getBlockExplorerUrlForTransaction } from "./blockExplorerUrls";
import { getChain, getSupportedChainName } from "./chains";
import { Checkout } from "./checkout";
import { useConnectedWalletAddressContext } from "./connectedWalletContextProvider";
import { deserializeFromModifiedBase64 } from "./serialize";
import { Strategy, getProposedStrategiesForProposedAgreement, getStrategiesForAgreement } from "./strategies";
import { getTokenKey } from "./tokens";
import { ExecuteTokenTransferButton, ExecuteTokenTransferButtonStatus, TransactionFeeUnaffordableError } from "./transactions";
import { useAddressOrENS } from "./useAddressOrENS";
import { useBestStrategy } from "./useBestStrategy";
import { useEnsName } from "./useEnsName";

// TODO add a big "continue" button at bottom of "select payment method" because if you don't want to change the method, it's unclear that you have to click on the current method. --> see the "continue" button at bottom of Amazon's payment method selection during mobile checkout.

// TODO use react-router routes for these different screens instead of state variables in this single route. This will make it easier to link to specific screens & payment states, and also make it easier to add new screens in the future. --> when we build the new route architecture, we'll have to figure out the right abstraction boundaries in terms of the pipeline of Checkout -> ac -> strategies -> best/otherStrategies -> pay now button -> menu of backup payment methods. There's a lot of potential ways to slice this, and I'm not sure which might be best.

export const Pay: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { isConnected, address } = useAccount();
  const [checkout] = useState<Checkout | undefined>(() => {
    const s = searchParams.get("c"); // TODO receive checkout from ContextLink instead of parsing it directly from searchparams
    if (s !== null) try {
      return deserializeFromModifiedBase64(s);
    } catch (e) {
      console.warn(e);
      return undefined;
    } else return undefined;
  });

  if (checkout === undefined) throw new Error(`checkout undefined`); // TODO rm this when the checkout is always be defined as provided by ContextLink
  if (!isReceiverProposedPayment(checkout.proposedAgreement)) throw new Error(`checkout wasn't a receiverProposedPayment`); // TODO support more checkout types than just receiverProposedPayment
  const rpp: ReceiverProposedPayment = checkout.proposedAgreement;

  const ac = useConnectedWalletAddressContext();

  const [status, setStatus] = useState<ExecuteTokenTransferButtonStatus | undefined>(undefined);

  const activeDemoAccount: string | undefined = useContext(ActiveDemoAccountContext);

  useEffect(() => { // if activeDemoAccount is defined, then we're in demo mode, the demo account has no provider, and the Pay Now button can't work and will error on usePrepareContractWrite, so below, we disable the Pay Now button, and here we clear any status that might have been set by the button, especially because certain features default to running based on status.activeTokenTransfer, which isn't being updated if the status is undefined.
    if (status && activeDemoAccount) setStatus(undefined);
  }, [status, activeDemoAccount]);

  const doReset = useCallback(() => {
    status?.reset();
  }, [status]);

  const errMsgToCopyAnonymized = (() => {
    if (status?.isError) {
      const errString = `${status.error} ${JSON.stringify(status.error)}`.replace(new RegExp(rpp.toAddress, 'gi'), '<redacted recipient address>');
      if (address === undefined) return errString;
      else return errString.replace(new RegExp(address, 'gi'), '<redacted connected wallet address>');
    } else return ' ';
  })();

  const [isErrorCopied, setCopied] = useClipboard(errMsgToCopyAnonymized, {
    successDuration: 10000, // `isErrorCopied` will go back to `false` after 10000ms
  });

  // TODO find a long-term solution instead of this retry button. Or maybe the long-term solution is a more polished retry button?
  const retryButton = status?.isError ? <div className="grid grid-cols-1 w-full gap-4">
    <div className="mt-4 grid grid-cols-2 w-full gap-4">
      <button className="bg-primary sm:hover:bg-primary-darker sm:hover:cursor-pointer text-white font-bold py-2 px-4 rounded" onClick={doReset}>Retry</button>
      <button className="bg-primary sm:enabled:hover:bg-primary-darker sm:enabled:hover:cursor-pointer text-white font-bold py-2 px-4 rounded" disabled={isErrorCopied} onClick={setCopied}>{isErrorCopied ? 'Copied. Please DM to @3cities_xyz' : 'Copy Error'}</button>
    </div>
    <span className="text-sm text-center">Sorry 😱</span>
    <span className="text-sm text-center">Please <span className="font-bold text-primary sm:hover:cursor-pointer sm:hover:text-primary-darker" onClick={setCopied}>copy error</span> and<br />paste in a DM to <a href="https://twitter.com/3cities_xyz" target="_blank" rel="noreferrer" className="font-bold text-primary sm:hover:cursor-pointer sm:hover:text-primary-darker">@3cities_xyz</a></span>
    <span className="text-sm text-center">Please submit the error for us to improve!</span>
  </div> : undefined;

  const strategies = useMemo<Strategy[] | undefined>(() => {
    if (checkout !== undefined && ac !== undefined && isReceiverProposedPayment(checkout.proposedAgreement)) return getStrategiesForAgreement(checkout.strategyPreferences, acceptReceiverProposedPayment(ac.address, checkout.proposedAgreement), ac);
    else return undefined;
  }, [checkout, ac]);

  const { bestStrategy, otherStrategies, disableStrategy, selectStrategy } = useBestStrategy(strategies);

  const recipientAddressBlockExplorerLink: string | undefined = (() => {
    return getBlockExplorerUrlForAddress((status?.activeTokenTransfer || bestStrategy?.tokenTransfer)?.token.chainId, rpp.toAddress);
  })();

  const [showFullRecipientAddress, setShowFullRecipientAddress] = useState(false);

  const { ensName: recipientEnsName } = useEnsName(rpp.toAddress);

  const recipientAddressOrEnsName: string = useAddressOrENS(rpp.toAddress,
    { truncated: !showFullRecipientAddress });

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

  const paymentScreen: false | JSX.Element = !status?.isSuccess && <div className={`${selectingPaymentMethod ? 'hidden' : '' /* WARNING here we hide the payment screen when selecting payment method instead of destroying it. This avoids an ExecuteTokenTransferButton remount each time the payment method changes, which is a mechanism to test reset logic and code paths. */}`}>
    <div className="w-full py-6">
      {(() => {
        if (!isConnected) return <ConnectWalletButton disconnectedLabel="Connect Wallet to Pay" />;
        else if (bestStrategy === undefined) return <button
          type="button"
          className="rounded-md p-3.5 bg-tertiary text-black pointer-events-none w-full"
        >
          Connected wallet has no payment options
        </button>;
        else return <div className="relative"><ExecuteTokenTransferButton
          tt={bestStrategy.tokenTransfer}
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
          setStatus={setStatus}
          {...(activeDemoAccount !== undefined && { disabled: true })}
        />
          {!retryButton && activeDemoAccount && (
            <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-tertiary-darker-2 text-sm whitespace-nowrap text-center">
              disabled when<br />impersonating
            </span>
          )}
          {retryButton}
        </div>
      })()}
    </div>
    <div className="p-4 flex items-center gap-4 justify-between w-full border border-gray-300 bg-white rounded-t-md">
      <span>To:</span>
      <span className="font-bold inline-flex gap-1 place-content-between" style={{ overflowWrap: 'anywhere' }}>
        <span>{!showFullRecipientAddress && recipientAddressOrEnsName}{showFullRecipientAddress && rpp.toAddress} {showFullRecipientAddress && recipientEnsName && `(${recipientEnsName})`} {showFullRecipientAddress && recipientAddressBlockExplorerLink && <a href={recipientAddressBlockExplorerLink} target="_blank" rel="noreferrer" className="font-bold text-primary sm:hover:cursor-pointer sm:hover:text-primary-darker ml-1">explorer</a>}</span>
        <span className="flex place-items-center"><FaEye onClick={() => setShowFullRecipientAddress(v => !v)} className="w-4 sm:hover:text-gray-500 sm:hover:cursor-pointer" /></span>
      </span>
    </div>
    {checkout.proposedAgreement.note !== undefined && <div className="p-4 flex items-center w-full border-b border-x border-gray-300 bg-white">
      <span className="text-left">{checkout.proposedAgreement.note}</span>
    </div>}
    <div className="p-4 grid grid-cols-2 w-full border-b border-x border-gray-300 bg-white rounded-b-md">
      <span className="font-bold text-lg">Total:</span>
      <span className="font-bold text-lg text-right"><RenderLogicalAssetAmount {...checkout.proposedAgreement} showAllZeroesAfterDecimal={true} /></span>
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
          {activeDemoAccount && <span className="absolute bottom-[-1.4em] left-1/2 transform -translate-x-1/2 text-tertiary-darker-2 text-sm font-bold whitespace-nowrap">
            click ⬆️
          </span>}
        </button>({otherStrategies.length + 1 /* + 1 because we count the current bestStrategy among the methods */} payment methods)</span>}
      </div>
    </div>}
  </div>;

  const acceptedTokensAndChainsBox: false | JSX.Element = ac !== undefined && bestStrategy === undefined && <div className="w-full">
    {(() => {
      const pss = getProposedStrategiesForProposedAgreement(checkout.strategyPreferences, checkout.proposedAgreement);
      const allStrategiesTokenTickers: string[] = [... new Set(pss.map(ps => ps.receiverProposedTokenTransfer.token.ticker))];
      const allStrategiesChainIds: number[] = [... new Set(pss.map(ps => ps.receiverProposedTokenTransfer.token.chainId))];
      return <>
        <div className="pt-4 font-bold text-lg">Tokens accepted</div>
        <div className="p-2 border border-gray-300 bg-white rounded-b-md">{allStrategiesTokenTickers.join(", ")}</div>
        <div className="pt-4 font-bold text-lg">Chains accepted</div>
        <div className="p-2 border border-gray-300 bg-white rounded-b-md">{allStrategiesChainIds.map(getSupportedChainName).join(", ")}</div>
      </>;
    })()}
  </div>;

  const selectPaymentMethodScreen: false | JSX.Element = bestStrategy !== undefined && otherStrategies !== undefined && otherStrategies.length > 0 && <div className={`grid grid-cols-1 w-full items-center py-6 ${selectingPaymentMethod ? '' : 'hidden'}`}>
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
  </div>;

  const paymentSuccessfulBlockExplorerReceiptLink: string | undefined = (() => {
    if (!status?.isSuccess) return undefined;
    else return getBlockExplorerUrlForTransaction(status.activeTokenTransfer.token.chainId, status.successData.transactionHash);
  })();

  const paymentSuccessfulBaseText: string = (() => {
    if (status?.isSuccess) {
      return `Hey, I paid you ${renderLogicalAssetAmount({ ...checkout.proposedAgreement, showAllZeroesAfterDecimal: true })}${rpp.note ? ` for ${rpp.note}` : ''} using https://3cities.xyz.`;
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
    successDuration: 10000, // `isCopied` will go back to `false` after 10000ms
  });

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
        const toShare = {
          // title: "Money sent", // we omit title because some share contexts include it, some omit it, and we prefer our share content to be minimalist and consistently include no title
          text: paymentSuccessfulTextNoLinkToShare,
          ...(paymentSuccessfulBlockExplorerReceiptLink && { url: paymentSuccessfulBlockExplorerReceiptLink }),
        };
        if (navigator.canShare && navigator.canShare(toShare)) {
          navigator.share(toShare);
        } else setIsPaymentSuccessfulShareCopied();
      }}>
      {isPaymentSuccessfulShareCopied ? 'Receipt Copied' : 'Let them know you paid'}
    </button>
    {paymentSuccessfulBlockExplorerReceiptLink && <div className="flex flex-col justify-center items-center gap-2">
      <QRCode data={paymentSuccessfulBlockExplorerReceiptLink} />
      <span>Scan for <a href={paymentSuccessfulBlockExplorerReceiptLink} target="_blank" rel="noopener noreferrer" className="text-primary sm:hover:text-primary-darker sm:hover:cursor-pointer"> receipt</a></span>
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
