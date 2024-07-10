import { ETHTransferProxyABI, getETHTransferProxyContractAddress } from "@3cities/eth-transfer-proxy";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChainMismatchError, SwitchChainError, UserRejectedRequestError, erc20Abi, type TransactionReceipt } from "viem";
import { serialize, useAccount, useEstimateGas, useSendTransaction, useSimulateContract, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { SwitchChainErrorType } from "wagmi/actions";
import { Intersection } from "./Intersection";
import { Narrow } from "./Narrow";
import { PartialFor } from "./PartialFor";
import { Spinner } from "./Spinner";
import { Writable } from "./Writable";
import { getSupportedChainName } from "./chains";
import { hasOwnPropertyOfType } from "./hasOwnProperty";
import { Observer, makeObservableValue, useObservedValue } from "./observer";
import { TokenTransfer, TokenTransferForNativeCurrency, TokenTransferForToken, isTokenAndNotNativeCurrencyTransfer } from "./tokenTransfer";
import { useMemoObject } from "./useMemoObject";

// TODO build and save list of test cases to check all ExecuteTokenTransfer code paths, eg. (automatic retries, other features) X (token, native currency) X (wallets) X (chains) X (different transfer amounts including very small amounts)

// TODO broken insufficient fee detection with metamask+ledger --> with ryanb.eth connected in dev, I have 0 ETH in arb goerli, but the insufficient fee funds detection isn't working. I can pop-up the write but metamask won't let me approve it. prepare is succeeding, write is in progress and pops up transaction confirmation, but then metamask pop-up says insufficient ETH to pay gas --> is this a bug in wagmi.useSimulateContract?

// SignedTransactionForTokenTransfer is the result of a user signing a
// transaction to execute a TokenTransfer.
export type SignedTransactionForTokenTransfer = Readonly<{
  transactionHash: `0x${string}`; // the hash of the transaction that the user signed
  chainId: number; // the chainId of the chain on which the transaction was signed
  tokenTransfer: TokenTransfer; // the token transfer for which the user signed the transaction
}>;

// ExecuteTokenTransferButtonStatus represents a memoryless snapshot of the
// internal status of an ExecuteTokenTransferButton.
// ExecuteTokenTransferButton constructs these statuses internally as state
// changes and provides a callback for clients to receive the latest
// status. The status is semi-interactive and offers some functions to
// modify button state (currently just resetting the button).
export type ExecuteTokenTransferButtonStatus = Readonly<{
  activeTokenTransfer: TokenTransfer; // ExecuteTokenTransferButton does not support arbitrary ongoing changes to the props TokenTransfer. This is party because the underlying wagmi hooks don't gracefully support this, and partly because it can be bad UX to arbitrarily change an in-progress TokenTransfer. Instead, on initial render, the first TokenTransfer is cached, and subsequent updates to props TokenTransfer are ignored, unless the client calls reset(), in which case the current latest value of props TokenTransfer is recached. For convenience, this activeTokenTransfer is provided as the currently cached and active TokenTransfer. For example, a client could use activeTokenTransfer to ensure that token transfer details displayed to the user always correspond to the internal transfer details being executed.
  reset: () => void; // reset() resets the ExecuteTokenTransferButton to the initial state, and recaches the latest value of props TokenTransfer. This is useful if the client wants to change the props TokenTransfer, but doesn't want to create a new ExecuteTokenTransferButton component.
  status: 'Error' | 'InProgress' | 'NeedToSwitchChainManually' | 'Success';
  isError: boolean;
  error?: Error;
  inProgress: boolean;
  buttonClickedAtLeastOnce: boolean; // true iff the button was clicked at least once by the user for the current activeTokenTransfer. NB if the button is auto-clicked via autoClickIfNeverClicked=true then this counts as a click and buttonClickedAtLeastOnce will be true
  needToSwitchChainManually: boolean;
  userIsSigningTransaction: boolean; // true iff the user is currently in the process of signing the transaction (eg. the wallet transaction confirmation pop-up is active and the user has not yet accepted or rejected the transaction).
  signedTransaction?: SignedTransactionForTokenTransfer; // defined iff the user has successfully signed a transaction. Note that signedTransaction is set immediately after successful signing, before the transaction is confirmed, and is never updated unless the client calls reset()
  isSuccess: boolean;
  successData?: TransactionReceipt;
} & ({
  status: 'Error';
  isError: true;
  error: Error;
  inProgress: false;
  buttonClickedAtLeastOnce: boolean;
  needToSwitchChainManually: false;
  userIsSigningTransaction: false;
  signedTransaction?: SignedTransactionForTokenTransfer;
  isSuccess: false;
  successData?: never;
} | {
  status: 'InProgress';
  isError: false;
  error?: never;
  inProgress: true;
  buttonClickedAtLeastOnce: boolean;
  needToSwitchChainManually: false;
  userIsSigningTransaction: boolean;
  signedTransaction?: SignedTransactionForTokenTransfer;
  isSuccess: false;
  successData?: never;
} | {
  status: 'NeedToSwitchChainManually';
  isError: false;
  error?: never;
  inProgress: false;
  buttonClickedAtLeastOnce: boolean;
  needToSwitchChainManually: true;
  userIsSigningTransaction: false;
  signedTransaction?: never;
  isSuccess: false;
  successData?: never;
} | {
  status: 'Success';
  isError: false;
  error?: never;
  inProgress: false;
  buttonClickedAtLeastOnce: true;
  needToSwitchChainManually: false;
  userIsSigningTransaction: false;
  signedTransaction: SignedTransactionForTokenTransfer;
  isSuccess: true;
  successData: TransactionReceipt;
})>;

export type ExecuteTokenTransferButtonProps = {
  tt: TokenTransfer | undefined; // the token transfer this button will execute. If undefined, the button will appear to be loading forever, and the passed setStatus will never be called. WARNING ExecuteTokenTransferButton doesn't support arbitrary ongoing changes to the props TokenTransfer. See ExecuteTokenTransferButtonStatus.activeTokenTransfer.
  nativeTokenTransferProxy: 'never' | 'prefer' | 'require'; // 3cities supports automatic use of a built-in proxy that emits an ERC20-compliant Transfer event for a native token transfer. This proxy exists because generalized offchain detection of ETH transfers (eg. when using smart contract wallets) can't be done using the ethrpc api, and can only be done with non-standard tracing APIs. This button can automatically route native token transfers through our built-in proxy, such that the transfers are detectable by monitoring for Transfer events. Our built-in proxy is a stateless hyperstructure that never has custody of funds and simply forwards any ETH sent to the specified recipient and emits a Transfer event, using about 50% more gas than a standard ETH transfer. A permament solution to this problem has been proposed via EIP-7708: ETH transfers emit a log. If set to 'never', this proxy will never be used and native token transfers will occur ordinarily (standard ETH transfer). If 'prefer', the proxy will be used if it's available on the chain where the native token transfer is being executed. If 'require', the proxy must be used and native token transfers attempted on chains where the proxy is unavailable will result in an error status.
  onClickPassthrough?: () => void; // iff defined, when the button is clicked, that click will be ignored internally and instead passed through to this callback. This allows clients to reuse this same button for other purposes. For example, clicking the button sign a message. onClickPassthrough is interoperable (works with) with other props, such as `disabled` and `showLoadingSpinnerWhenDisabled`. NB clicks that are passed through to onClickPassthrough are completely ignored internally, eg. a click forwarded to onClickPassthrough will not result in status.buttonClickedAtLeastOnce being set to true
  autoReset?: true; // if set, the button will automatically call its own status.reset to update cached token transfer details when props.tt changes, but only if the user isn't currently signing the transaction or has already signed the transaction, in which case the button is never auto-reset but can still be reset manually by the client. WARNING automatic resets trigger a new status, so clients must ensure a new status doesn't unconditionally compute new tt object, or else an infinite async render loop will occur (new tt -> auto reset -> async reset -> new status -> repeat)
  autoClickIfNeverClicked?: boolean; // iff true, the button will automatically click itself iff it's ready to click and has never been clicked (ie. !buttonClickedAtLeastOnce, noting that buttonClickedAtLeastOnce is reset to false on status.reset()). For example, this allows a client to have the user's first click perform some other action (such as siging a message) and then automatically click the button to execute the token transfer following the resolution of that action, preventing the user from having to click the button twice. WARNING an automatic click/execute triggers a new status, so clients must ensure a new status doesn't unconditionally automatically click/execute again (which can only occur if the new status triggers an unconditional reset which resets buttonClickedAtLeastOnce), or else an infinite async render loop will occur (auto execute -> new status -> async reset -> repeat)
  loadForeverOnTransactionFeeUnaffordableError?: true; // when the button detects that the user can't afford the transaction fee for the active token transfer, the button UI normally shows an error, but if this is set, instead will show itself as loading. When the fee is unaffordable, regardless if this set, `status.error` will be an instanceof TransactionFeeUnaffordableError, which allows the client to detect fee unaffordability and optionally, replace the active transfer with one that the user may be able to afford. The point of this flag is to enable the client to replace the active transfer on fee unaffordability without the janky intermediate UI state of the button showing an error. WARNING TransactionFeeUnaffordableError is detected on a case-by-case basis depending on the wallet's implementation, so the transaction might be (or end up being) unaffordable even if there's no error or the error isn't an instanceof TransactionFeeUnaffordableError. Ie. TransactionFeeUnaffordableError is subject to false negatives, but not false positives.
  label: string; // label to put on the button, eg. "Pay Now", "Donate Now", "Place your order"
  successLabel: string; // label to put on the button after the token transfer is successful
  warningLabel?: JSX.Element; // warning label to put on the side of the button. In certain cases, the button produces its own internal warnings, in which case this passed warningLabel takes precedence
  errorLabel?: string; // iff defined, button will be forced into an error state and this error label will be displayed
  disabled?: true | string; // force-disable disable the button. Pass true to disable the button. Pass a string to disable the button and display the passed string as the disabled reason. Note, the button may still be disabled for internal reasons even if this is not set.
  showLoadingSpinnerWhenDisabled?: true; // iff true, the loading spinner will be displayed while the button is disabled. Otherwise, the loading spinner is displayed only when the button is loading internally
  className?: string // className to unconditionally apply to the button element
  disabledClassName?: string // className to apply iff button is disabled
  enabledClassName?: string // className to apply iff button is enabled
  loadingSpinnerClassName?: string // className applied to the loading spinner iff button is loading. The text color is used for the loading spinner's foreground color, and the svg fill color is used for the loading spinner's background color. Recommended: set text color to same color as the disabled button label (as button is disabled during loading) and fill color to same color as button's (disabled) background color.
  errorClassName?: string // className applied to any error label
  warningClassName?: string // className applied to any warning label
  setStatus?: (status: ExecuteTokenTransferButtonStatus | undefined) => void; // callback for the client to receive updated button status. Only the most recently received status is valid. All previously received statuses must be discarded by the client. If undefined is received, it means no status is available (typically because the component has unmounted) and that the most recent defined status is stale. React note: if an ancestor component of ExecuteTokenTransferButton caches this updated status as state, then ExecuteTokenTransferButton will rerender redundantly each time it updates the status (because an ancestor's subtree rerenders on state change). These redundant rerenders can be avoided by storing eg. an Observer in the ancestor and using the updated status in a cousin component (including potentially caching it as state).
};

// ExecuteTokenTransferButton is a batteries-included button to manage
// the full lifecycle of a single token or native currency transfer.
export const ExecuteTokenTransferButton: React.FC<ExecuteTokenTransferButtonProps> = ({ setStatus, ...props }) => {
  const [ov] = useState(() => makeObservableValue<ExecuteTokenTransferStatus | undefined>(undefined));

  const innerSetStatus = useCallback((s: ExecuteTokenTransferStatus | undefined): void => {
    // the job of this outer ExecuteTokenTransferButton component is to avoid necessary rerenders (especially not rerendering on each transfer status update) and to act as plumbing between the transfer, the client, and the UI. Here, a new status has been produced by the transfer, and so this component will push that status to the UI and the client, while leveraging ObservableValue to avoid state updates to itself:
    ov.setValueAndNotifyObservers(s);
    if (setStatus) setStatus(s && transferStatusToButtonStatus(s));
  }, [setStatus, ov]);

  const [isExecuteTokenTransferRendered, executeTokenTransferElement]: [true, React.JSX.Element] | [false, null] = props.tt ? [true, <ExecuteTokenTransfer key="ett" tt={props.tt} nativeTokenTransferProxy={props.nativeTokenTransferProxy} setStatus={innerSetStatus} />] : [false, null];

  return <>
    {executeTokenTransferElement}
    <ExecuteTokenTransferButtonUI {...props} observer={ov.observer} isExecuteTokenTransferRendered={isExecuteTokenTransferRendered} />
  </>;
}

const defaultExecuteTokenTransferStatus: PartialFor<Narrow<ExecuteTokenTransferStatus, 'status', 'Loading'>, 'activeTokenTransfer'> = {
  reset: () => { },
  status: 'Loading',
  isError: false,
  isReadyToExecute: false,
  executeCalledAtLeastOnce: false,
  isLoading: true,
  loadingStatus: 'Init',
  needToSwitchChainManually: false,
  isSuccess: false,
};

type ExecuteTokenTransferButtonUIProps = Pick<ExecuteTokenTransferButtonProps, 'tt' | 'onClickPassthrough' | 'autoReset' | 'autoClickIfNeverClicked' | 'loadForeverOnTransactionFeeUnaffordableError' | 'label' | 'successLabel' | 'warningLabel' | 'errorLabel' | 'disabled' | 'showLoadingSpinnerWhenDisabled' | 'className' | 'disabledClassName' | 'enabledClassName' | 'errorClassName' | 'warningClassName' | 'loadingSpinnerClassName'> & {
  observer: Observer<ExecuteTokenTransferStatus | undefined>;
  isExecuteTokenTransferRendered: boolean; // true iff the underlying ExecuteTokenTransfer associated with this ExecuteTokenTransferButton is currently being rendered
};

const ExecuteTokenTransferButtonUI: React.FC<ExecuteTokenTransferButtonUIProps> = ({ tt, onClickPassthrough, autoReset, autoClickIfNeverClicked, loadForeverOnTransactionFeeUnaffordableError, label, successLabel, warningLabel, errorLabel, disabled, showLoadingSpinnerWhenDisabled, className, disabledClassName, enabledClassName, errorClassName, warningClassName, loadingSpinnerClassName, observer, isExecuteTokenTransferRendered, }) => {
  const { connector: activeConnector } = useAccount();
  const statusFromObserver: ExecuteTokenTransferStatus | undefined = useObservedValue(observer);
  const status = (isExecuteTokenTransferRendered && statusFromObserver) || defaultExecuteTokenTransferStatus; // if the underlying ExecuteTokenTransfer is not currently being rendered, then any statusFromObserver is by definition stale as it's from an unmounted ExecuteTokenTransfer, so we mustn't use it. NB when ExecuteTokenTransfer is unmounted it sends a final undefined status, but statusFromObserver is updated async based on effect timers, whereas isExecuteTokenTransferRendered is computed synchronously on each render, so when ExecuteTokenTransfer is unmounted, isExecuteTokenTransferRendered flips to false before statusFromObserver becomes the final undefined status
  // @eslint-no-use-below[statusFromObserver] -- statusFromObserver is abstracted over in `status` and not intended to be used again

  const connectedWalletAutoSigns: boolean = activeConnector ? activeConnector.id.includes("web3auth") : false; // true iff the connected wallet does not ask the user to sign the transaction and instead signs it on their behalf. NB we don't actually use web3auth anymore and it was entirely removed from the codebase, but we retained this as an example of how to handle a wallet that auto-signs transactions

  useEffect(() => {
    if (!onClickPassthrough && status.suggestAutoExecute) status.execute(); // NB here we never auto execute if onClickPassthrough is defined because passthrough clicks are intended to supercede the button's internal functionality. Eg. if onClickPassthrough was defined to support some client feature, it would be jarring and potentially inconsistent to begin auto executing a token transfer
  }, [onClickPassthrough, status]);

  const se = status.execute; // use a local so that the useEffect dependency isn't on the entire object
  const seclo = status.executeCalledAtLeastOnce; // use a local so that the useEffect dependency isn't on the entire object
  useEffect(() => { // handle autoClickIfNeverClicked
    if (!onClickPassthrough && autoClickIfNeverClicked && se && !seclo) se(); // NB here we never auto execute if onClickPassthrough is defined because passthrough clicks are intended to supercede the button's internal functionality. Eg. if onClickPassthrough was defined to support some client feature, it would be jarring and potentially inconsistent to begin auto executing a token transfer
  }, [onClickPassthrough, autoClickIfNeverClicked, se, seclo]);
  // @eslint-no-use-below[se]
  // @eslint-no-use-below[seclo]

  useEffect(() => {
    if (autoReset && !(status.isLoading && status.loadingStatus === 'SigningTransaction') && !status.signedTransaction) status.reset(); // WARNING we never want to auto-reset after the user has signed the transaction (or is currently signing it) because that would lead to a terrible UX where a payment that's already been authorized is forgotten by the button
    // eslint-disable-next-line react-hooks/exhaustive-deps -- here we don't care if status changes, all we care about is if tt changes then we should attempt an auto reset, and if we also depend on status, then we'll have both incorrect behavior (reseting on any status change) as well as an infinite reset loop (status changes -> reset -> repeat)
  }, [autoReset, tt]);

  const computedOnClick: (() => void) | undefined = onClickPassthrough || status.execute;

  const isButtonDisabled = disabled !== undefined || computedOnClick === undefined;
  const computedClassName = `relative ${className || ''} ${isButtonDisabled ? (disabledClassName || '') : ''} ${!isButtonDisabled ? (enabledClassName || '') : ''}`;
  const computedLabel = (() => {
    const disabledReason = typeof disabled === 'string' ? disabled : undefined;
    const computedError: JSX.Element | undefined = (() => {
      if (status.error !== undefined && (status.error instanceof TransactionFeeUnaffordableError) && !loadForeverOnTransactionFeeUnaffordableError) return <span className={warningClassName || ''}>Blockchain fee unaffordable</span>;
      else if (errorLabel || status.error !== undefined && !(status.error instanceof TransactionFeeUnaffordableError)) return <span className={errorClassName || ''}>{` Error: ${errorLabel || status.error?.message}`}</span>;
      else return undefined;
    })();
    const needToDismissOtherChainSwitch = status.warning === 'ChainSwitchNonFatalError' ? 'Finish other chain switch and retry' : undefined;
    const needToSwitchChainManuallyMsg = status.needToSwitchChainManually ? <span className={warningClassName || ''}>Switch wallet chain to {getSupportedChainName(status.activeTokenTransfer.token.chainId)} ({status.activeTokenTransfer.token.chainId})</span> : undefined;
    const needToSignInWallet = status.isLoading && status.loadingStatus === 'SigningTransaction' && !connectedWalletAutoSigns ? 'Confirm in Wallet' : undefined;
    const payingInProgress = status.isLoading && (
      status.loadingStatus === 'ConfirmingTransaction'
      || (status.loadingStatus === 'SigningTransaction' && connectedWalletAutoSigns)
    ) ? 'Paying...' : undefined;
    const success = status.isSuccess ? successLabel : undefined;
    return <>{disabledReason || computedError || needToDismissOtherChainSwitch || needToSwitchChainManuallyMsg || needToSignInWallet || payingInProgress || success || label}</>;
  })();
  const computedSpinner: JSX.Element | undefined =
    (disabled === undefined // don't show loading spinner if button has been forcibly disabled by the client because even if it is loading internally, it won't be clickable until the client changes this
      || showLoadingSpinnerWhenDisabled // but, potentially show the spinner when forcibly disabled if the client has set this option
    ) && (
        status.isLoading // show loading spinner if button is loading, of course
        || (status.error !== undefined && (status.error instanceof TransactionFeeUnaffordableError) && loadForeverOnTransactionFeeUnaffordableError) // show loading spinner if the button is errored, but the error is that the transaction fee is unaffordable and the client has set the flag to indicate we should render the button as loading when fee is unaffordable (typically, the client would request this because the client will then replace the active token transfer with one that might be affordable)
        || (disabled !== undefined && showLoadingSpinnerWhenDisabled) // show loading spinner if button is forcibly disabled and client requested to show loading spinner while forcibly disabled
      ) ? <Spinner
      containerClassName="absolute top-1/2 transform -translate-y-1/2 right-4 z-10 h-6 w-6 flex items-center justify-center"
      spinnerClassName={`${loadingSpinnerClassName}`}
    /> : undefined;
  const computedWarning = (warningLabel || status.warning) && <div className={`absolute top-1/2 transform -translate-y-1/2 right-4 text-sm leading-tight ${warningClassName || ''}`}>
    {(() => {
      // here we currently return the same "Rejected in wallet" warning for all warning types because I can't think of better language for chain add/switch that fits within the limited space available for this warning --> TODO maybe more these warnings should be implemented in computedLabel as is ChainSwitchNonFatalError
      if (warningLabel) return warningLabel;
      else if (!status.warning) throw new Error("unreachable"); // typescript doesn't know that status.warning must be defined here
      else switch (status.warning) {
        case 'UserRejectedTransaction':
          return <span>Rejected<br />in wallet</span>;
        case 'UserRejectedChainSwitch':
          return <span>Rejected<br />in wallet</span>;
        case 'ChainSwitchNonFatalError':
          return <span></span>; // we render ChainSwitchNonFatalError by updating computedLabel to a helpful message 
        case 'UserRejectedChainAdd':
          return <span>Rejected<br />in wallet</span>;
      }
    })()}
  </div>;

  return <button
    type="button"
    disabled={isButtonDisabled}
    onClick={computedOnClick}
    className={computedClassName}
  >
    {computedLabel}
    {computedWarning}
    {computedSpinner}
  </button>;
}

type ExecuteTokenTransferLoadingStatus = 'Init' | 'SwitchingChain' | 'SigningTransaction' | 'ConfirmingTransaction';

// ExecuteTokenTransferStatus represents a memoryless snapshot of the
// internal status of an ExecuteTokenTransfer. ExecuteTokenTransfer
// constructs these statuses internally as its state changes and provides a
// callback for clients to receive the latest status. The status is
// semi-interactive and offers some functions to affect the transfer
// (currently just executing and resetting the transfer).
// ExecuteTokenTransferStatus is plumbing-only (no UI) and relatively
// low-level, and most clients should instead use the higher-level
// ExecuteTokenTransferButton and its ExecuteTokenTransferButtonstatus.
// However, clients that need custom UI beyond the customizability of
// ExecuteTokenTransferButton can use ExecuteTokenTransfer and
// ExecuteTokenTransferStatus directly.
export type ExecuteTokenTransferStatus = Readonly<{
  activeTokenTransfer: TokenTransfer; // ExecuteTokenTransfer does not support arbitrary ongoing changes to the props TokenTransfer. This is party because the underlying wagmi hooks don't gracefully support this, and partly because it can be bad UX to arbitrarily change an in-progress TokenTransfer. Instead, on initial render, the first TokenTransfer is cached, and subsequent updates to props TokenTransfer are ignored, unless the client calls reset(), in which case the current latest value of props TokenTransfer is recached. For convenience, this activeTokenTransfer is provided as the currently cached and active TokenTransfer. For example, a client could use activeTokenTransfer to ensure that token transfer details displayed to the user always correspond to the internal transfer details being executed.
  reset: () => void; // reset() resets the ExecuteTokenTransfer to the initial state, and recaches the latest value of props TokenTransfer. This is useful if the client wants to change the props TokenTransfer, but doesn't want to create a new ExecuteTokenTransfer component.
  status: 'Error' | 'ReadyToExecute' | 'Loading' | 'NeedToSwitchChainManually' | 'Success';
  isError: boolean;
  error?: Error;
  warning?: // warning is an enum of things that can go temporarily wrong but don't block the transfer from potentially eventually succeeding. Warnings are set as they occur, and may or may not be eventually cleared (set to undefined) or overwritten with a new warning
  'UserRejectedChainAdd' // the user had to switch chain, but the user's wallet doesn't yet have this chain, and wagmi asked the user to add the chain, but the user rejected the chain add.
  | 'UserRejectedChainSwitch' // the user had to switch chain, the switch was offered to the user, but the user rejected the chain switch. 
  | 'ChainSwitchNonFatalError' // the user had to switch chain, and the ExecuteTokenTransfer component attempted to launch the switch chain prompt, but there was a non-fatal error, usually a prior switch chain prompt is still active, so the user should close the old chain switch prompts and retry.
  | 'UserRejectedTransaction' // the user rejected signing the transaction.
  isReadyToExecute: boolean;
  execute?: () => void; // iff defined, the client can call execute() to move the token transfer forward. In practice, calling execute() triggers a chain add, chain switch, or transaction confirmation in the user's wallet. If the client doesn't call execute(), the transfer will not move forward. If execute() is undefined, the transfer is not ready to be moved forward, eg. because it's loading, it errored, or the transaction was already signed by the user.
  executeCalledAtLeastOnce: boolean; // true iff execute() was called at least once by the client for the current activeTokenTransfer.
  suggestAutoExecute?: true; // true iff ExecuteTokenTransfer recommends that the client automatically invoke execute instead of eg. waiting for the user to click a button.
  isLoading: boolean;
  loadingStatus?: ExecuteTokenTransferLoadingStatus;
  needToSwitchChainManually: boolean; // true iff a wallet active chain switch is required to execute the to token transfer, but ExecuteTokenTransfer was unable to facilitate an automatic chain switch, and the chain must be switched by the client (such as by asking the user to switch it manually).
  signedTransaction?: SignedTransactionForTokenTransfer; // defined iff the user has successfully signed a transaction. Note that signedTransaction is set immediately after successful signing and before the transaction is confirmed, and is never updated unless the client calls reset()
  isSuccess: boolean;
  successData?: TransactionReceipt;
} & ({
  status: 'Error';
  isError: true;
  error: Error;
  warning?: never;
  isReadyToExecute: false;
  execute?: never;
  executeCalledAtLeastOnce: boolean;
  suggestAutoExecute?: never;
  isLoading: false;
  loadingStatus?: never;
  needToSwitchChainManually: false;
  signedTransaction?: SignedTransactionForTokenTransfer;
  isSuccess: false;
  successData?: never;
} | {
  status: 'ReadyToExecute';
  isError: false;
  error?: never;
  warning?: string; // see enum of warnings in base type
  isReadyToExecute: true;
  execute: () => void;
  executeCalledAtLeastOnce: boolean;
  suggestAutoExecute?: true;
  isLoading: false;
  loadingStatus?: never;
  needToSwitchChainManually: false;
  signedTransaction?: never;
  isSuccess: false;
  successData?: never;
} | ({
  status: 'Loading';
  isError: false;
  error?: never;
  warning?: never;
  isReadyToExecute: false;
  execute?: never;
  executeCalledAtLeastOnce: boolean;
  suggestAutoExecute?: never;
  isLoading: true;
  loadingStatus: ExecuteTokenTransferLoadingStatus;
  needToSwitchChainManually: false;
  isSuccess: false;
  successData?: never;
} & (
    { loadingStatus: 'ConfirmingTransaction'; signedTransaction: SignedTransactionForTokenTransfer }
    | { loadingStatus: Exclude<ExecuteTokenTransferLoadingStatus, 'ConfirmingTransaction'>; signedTransaction?: never }
  )) | {
    status: 'NeedToSwitchChainManually';
    isError: false;
    error?: never;
    warning?: never;
    isReadyToExecute: false;
    execute?: never;
    executeCalledAtLeastOnce: boolean;
    suggestAutoExecute?: never;
    isLoading: false;
    loadingStatus?: never;
    needToSwitchChainManually: true;
    signedTransaction?: never;
    isSuccess: false;
    successData?: never;
  } | {
    status: 'Success';
    isError: false;
    error?: never;
    warning?: never;
    isReadyToExecute: false;
    execute?: never;
    executeCalledAtLeastOnce: true;
    suggestAutoExecute?: never;
    isLoading: false;
    loadingStatus?: never;
    needToSwitchChainManually: false;
    signedTransaction: SignedTransactionForTokenTransfer;
    isSuccess: true;
    successData: TransactionReceipt;
  })>;

function transferStatusToButtonStatus(s: ExecuteTokenTransferStatus): ExecuteTokenTransferButtonStatus {
  switch (s.status) {
    case 'Error': return {
      activeTokenTransfer: s.activeTokenTransfer,
      reset: s.reset,
      status: 'Error',
      isError: true,
      error: s.error,
      inProgress: false,
      buttonClickedAtLeastOnce: s.executeCalledAtLeastOnce,
      needToSwitchChainManually: false,
      userIsSigningTransaction: false,
      ...(s.signedTransaction && { signedTransaction: s.signedTransaction } satisfies Pick<ExecuteTokenTransferButtonStatus, 'signedTransaction'>),
      isSuccess: false,
    };
    case 'ReadyToExecute': return {
      activeTokenTransfer: s.activeTokenTransfer,
      reset: s.reset,
      status: 'InProgress',
      isError: false,
      inProgress: true,
      buttonClickedAtLeastOnce: s.executeCalledAtLeastOnce,
      needToSwitchChainManually: false,
      userIsSigningTransaction: false,
      isSuccess: false,
    };
    case 'Loading': return {
      activeTokenTransfer: s.activeTokenTransfer,
      reset: s.reset,
      status: 'InProgress',
      isError: false,
      inProgress: true,
      buttonClickedAtLeastOnce: s.executeCalledAtLeastOnce,
      needToSwitchChainManually: false,
      userIsSigningTransaction: s.loadingStatus === 'SigningTransaction',
      ...(s.loadingStatus === 'ConfirmingTransaction' && { signedTransaction: s.signedTransaction } satisfies Pick<ExecuteTokenTransferButtonStatus, 'signedTransaction'>),
      isSuccess: false,
    };
    case 'NeedToSwitchChainManually': return {
      activeTokenTransfer: s.activeTokenTransfer,
      reset: s.reset,
      status: 'NeedToSwitchChainManually',
      isError: false,
      inProgress: false,
      buttonClickedAtLeastOnce: s.executeCalledAtLeastOnce,
      needToSwitchChainManually: true,
      userIsSigningTransaction: false,
      isSuccess: false,
    };
    case 'Success': return {
      activeTokenTransfer: s.activeTokenTransfer,
      reset: s.reset,
      status: 'Success',
      isError: false,
      inProgress: false,
      buttonClickedAtLeastOnce: s.executeCalledAtLeastOnce,
      needToSwitchChainManually: false,
      userIsSigningTransaction: false,
      signedTransaction: s.signedTransaction,
      isSuccess: true,
      successData: s.successData,
    };
  }
}

export type ExecuteTokenTransferProps = {
  tt: TokenTransfer; // the token transfer this will execute. WARNING ExecuteTokenTransfer doesn't support arbitrary ongoing changes to the props TokenTransfer. See ExecuteTokenTransferStatus.activeTokenTransfer.
  nativeTokenTransferProxy: 'never' | 'prefer' | 'require'; // 3cities supports automatic use of a built-in proxy that emits an ERC20-compliant Transfer event for a native token transfer. This proxy exists because generalized offchain detection of ETH transfers (eg. when using smart contract wallets) can't be done using the ethrpc api, and can only be done with non-standard tracing APIs. Clients may automatically route native token transfers through this built-in proxy, such that the transfers are detectable by monitoring for Transfer events. Our built-in proxy is a stateless hyperstructure that never has custody of funds and simply forwards any ETH sent to the specified recipient and emits a Transfer event, using about 50% more gas than a standard ETH transfer. A permament solution to this problem has been proposed via EIP-7708: ETH transfers emit a log. If set to 'never', this proxy will never be used and native token transfers will occur ordinarily (standard ETH transfer). If 'prefer', the proxy will be used if it's available on the chain where the native token transfer is being executed. If 'require', the proxy must be used and native token transfers attempted on chains where the proxy is unavailable will result in an error status.
  confirmationsBeforeSuccess?: number; // number of block confirmations to wait for before reporting a successful transfer. Defaults to 1
  setStatus: (status: ExecuteTokenTransferStatus | undefined) => void; // callback for the client to receive updated transfer status. This callback is mandatory because the client must call status.execute() to move the transfer forward. Only the most recently received status is valid. All previously received statuses must be discarded by the client. If undefined is received, it means no status is available (typically because the component has unmounted) and that the most recent defined status is stale. React note: if an ancestor component of ExecuteTokenTransfer caches this updated status as state, then ExecuteTokenTransfer will rerender redundantly each time it updates the status (because an ancestor's subtree rerenders on state change). These redundant rerenders can be avoided by storing eg. an Observer in the ancestor and using the updated status in a cousin component (including potentially caching it as state)
}

// ExecuteTokenTransfer is our low-level facility to execute a single
// token transfer. ExecuteTokenTransfer manages the full transfer
// lifecycle, and is our plumbing-only (no UI) low-level facility built
// on the even-lower-level wagmi hooks. Most clients should instead use
// the higher-lever ExecuteTokenTokenTransferButton. However, clients
// that need custom UI beyond the customizability of
// ExecuteTokenTransferButton can use ExecuteTokenTransfer directly.
// Note that our implementation strategy for ExecuteTokenTransfer is to
// build it on the wagmi react hooks instead of the wagmi core action
// API. In general, a benefit of building on the action API is that
// actions can be called conditionally but hooks can't. Yet, the
// benefits of building on the wagmi hooks instead of the actions API
// are that 1) the wagmi hooks automatically provide updated React
// state, with no need to re-run actions or manage promise lifecycles,
// and 2) wagmi hooks are built on react-query and that gives access to
// potentially using suspense mode and other feaures in the future. And
// that's why ExecuteTokenTransfer is built on wagmi hooks and not wagmi
// core actions.
export const ExecuteTokenTransfer: React.FC<ExecuteTokenTransferProps> = ({ setStatus, ...props }) => {
  const { isConnected, chain: activeChain } = useAccount();
  const [doReset, setDoReset] = useState(false); // doReset is set to true to immediately trigger an internal reset. doReset exists so that reset()'s useCallback doesn't depend on props.tt, so that a client that changes props.tt isn't triggering unnecessary rerenders and status updates, which can cause infinite render loops if an ancestor updates its state on status update.
  const [cachedTT, setCachedTT] = useState<ExecuteTokenTransferProps['tt']>(props.tt); // wagmi's prepare/write/wait hooks aren't particularly resilient to automatic changes in the transfer details. Instead, we cache props.tt to lock in the transfer instance. Clients that wish to change the value of tt can call status.reset() to force a recache to the latest value of props.tt.

  const [isSuccess, setIsSuccess] = useState(false); // wait.isSuccess can sometimes reset itself back to idle (such as on a chain switch), so to prevent a Success status from clearing itself, we cache success status as state so that after the user has successfully paid, the transfer never clears its success status unless reset.
  const [signedTransaction, setSignedTransaction] = useState<SignedTransactionForTokenTransfer | undefined>(undefined); // defined iff the user has successfully signed a transaction. Note that signedTransaction is set immediately after successful signing, before the transaction is confirmed, and is never updated unless the client calls reset(). The sole purpose of signedTransaction is to be surfaced to the client to eg. help the client decide whether or not they want to call reset() or eg. send the signed transaction details to some 3rd party. NB `write` can sometimes reset itself back to idle (such as on a chain switch), so to prevent loss of information, we cache signedTransaction as state.
  const [autoExecuteState, setAutoExecuteState] = useState<'none' | 'clickedExecuteAndStartedSwitchingChain' | 'finishedSwitchingChainAndShouldAutoExecute' | 'autoRetry'>("none"); // autoExecuteState is a small state machine used to control whether or not execution of prompting the user to sign the transaction will happen automatically. We want to auto-execute if the user already called status.execute() once (eg. user clicked button once) AND this click caused a chain switch to be triggered AND that chain switch was successful. This avoids requiring the user to click the button more than once when a chain add and/or switch is required. We also want to auto-execute if the transfer has determined it should be automatically retried.
  const [transactionReceipt, setTransactionReceipt] = useState<TransactionReceipt | undefined>(undefined); // `wait` can sometimes can reset itself (such as on chain switch), so we cache `wait.data: TransactionReceipt` into transactionReceipt so that after the user has successfully paid, the transfer always has a copy of its receipt.
  const [retries, setRetries] = useState(0); // number of retries, where a retry is attempted when an error occurs that isRetryableError (and would otherwise be a fatal error if it weren't retrayble). This retry count is used to prevent an infinite number of retries. WARNING `retries` is the only state that isn't automatically cleared across resets as it tracks the number of resets in service of automatic retries. Instead, `retries` is cleared only if the client calls status.reset(), so that the retry count is properly reset if the tokenTransfer changes.
  const [willAutoRetry, setWillAutoRetry] = useState(false); // true iff the transfer should update its autoExecuteState to automatically retry on a reset, instead of normally setting autoExecuteState="none"
  const isMaxRetriesExceeded: boolean = retries > 1;

  const onTransactionSigned = useCallback<(hash: `0x${string}`) => void>((hash) => {
    setSignedTransaction(prev => {
      const n: SignedTransactionForTokenTransfer = {
        transactionHash: hash,
        chainId: cachedTT.token.chainId,
        tokenTransfer: cachedTT,
      };
      if (prev) console.error("ExecuteTokenTransfer setSignedTransaction: expected signedTransaction to be previously undefined, prev=", prev, "new=", n);
      return n;
    });
  }, [setSignedTransaction, cachedTT]);

  const [transferMode, nativeTokenTransferProxyContractAddress, cachedTTNarrowed]:
    ['erc20Transfer', undefined, TokenTransferForToken]
    | ['nativeTokenTransfer', undefined, TokenTransferForNativeCurrency]
    | ['nativeTokenTransferProxy', `0x${string}`, TokenTransferForNativeCurrency]
    | ['errorNativeTokenTransferProxyRequiredButUnvailable', undefined, undefined] = (() => {
      if (isTokenAndNotNativeCurrencyTransfer(cachedTT)) return ['erc20Transfer', undefined, cachedTT];
      else if (props.nativeTokenTransferProxy === 'never') return ['nativeTokenTransfer', undefined, cachedTT];
      else {
        const c = getETHTransferProxyContractAddress(cachedTT.token.chainId);
        if (c) return ['nativeTokenTransferProxy', c, cachedTT];
        else if (props.nativeTokenTransferProxy === 'prefer') return ['nativeTokenTransfer', undefined, cachedTT];
        else return ['errorNativeTokenTransferProxyRequiredButUnvailable', undefined, undefined];
      }
    })();

  // ********** BEGIN hooks used only for token transfers (and not native currency transfers) **********
  const simulateContractParamsForErc20Transfer = useMemo((): Parameters<typeof useSimulateContract<typeof erc20Abi, 'transfer', readonly [`0x${string}`, bigint]>>[0] => { // here we must memoize so that a new object isn't created each render which would cause useSimulateContract to return a new value each render and trigger unnecessary status updates, which can then cause infinite render loops if an ancestor component rerenders each status update.
    if (transferMode === 'erc20Transfer') return {
      chainId: cachedTT.token.chainId,
      address: cachedTTNarrowed.token.contractAddress,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [cachedTT.receiverAddress, cachedTT.amount],
    } as const; else return undefined;
  }, [cachedTT, transferMode, cachedTTNarrowed]);
  const simulateContractForErc20Transfer = useMemoObject(useSimulateContract(simulateContractParamsForErc20Transfer), ['data', 'status', 'fetchStatus', 'error', 'refetch']); // WARNING the object returned by useSimulateContract is unconditionally recreated each render and so we use useMemoObject to stabilize the reference (NB the `data` field is an object that has a stable reference across renders)

  const writeContractParamsForErc20Transfer = useMemo((): Parameters<typeof useWriteContract>[0] => { // here we must memoize so that a new object isn't created each render which could cause useWriteContract to return a new value each render and trigger unnecessary status updates, which can then cause infinite render loops if an ancestor component rerenders each status update.
    return {
      mutation: {
        onSuccess: onTransactionSigned,
      },
    };
  }, [onTransactionSigned]);
  const writeContractForErc20Transfer = useMemoObject(useWriteContract(writeContractParamsForErc20Transfer), ['writeContract', 'data', 'status', 'error', 'reset']); // WARNING the object returned by useWriteContract is unconditionally recreated each render and so we use useMemoObject to stabilize the reference

  const wcerc20 = writeContractForErc20Transfer.writeContract; // allow hook dependency to be only on writeContract instead of entire object
  const { isSuccess: serc20isSuccess, data: serc20Data } = simulateContractForErc20Transfer; // allow hook dependency to be only on isSuccess and data instead of entire object
  const executeWriteContractForErc20Transfer = useMemo((): (() => void) | undefined => {
    if (serc20isSuccess) return () => wcerc20(serc20Data.request);
    else return undefined;
  }, [serc20isSuccess, serc20Data, wcerc20]);
  // @eslint-no-use-below[serc20isSuccess]
  // @eslint-no-use-below[serc20Data]
  // @eslint-no-use-below[wcerc20]
  // ********** END hooks used only for token transfers (and not native currency transfers) **********

  // ********** BEGIN hooks used only for native currency transfers (and not token transfers or native currency transfers using the proxy) **********
  const unsafeRawSendTransactionParamsForNativeTokenTransfer = useMemo(() => { // unlike useSimulateContract and useWriteContract, the full transfer parameters required for useSendTransaction are not returned by useEstimateGas, so we need a copy of the native token transfer params to provide to both. This is marked as unsafe because we'd prefer for it to be only conditionally defined iff transferMode === 'nativeTokenTransfer'; these data must not be used when transferMode !== 'nativeTokenTransfer'
    return {
      chainId: cachedTT.token.chainId,
      to: cachedTT.receiverAddress,
      value: cachedTT.amount,
    } as const;
  }, [cachedTT]);

  const estimateGasParamsForNativeTokenTransfer = useMemo(() => { // here we must memoize estimateGasParamsForNativeTokenTransfer so that a new object isn't created each render which would cause useEstimateGas to return a new value each render and trigger unnecessary status updates, which can then cause infinite render loops if an ancestor component rerenders each status update. --> NB here we omit the result type `Parameters<typeof useEstimateGas>[0]` because for some reason, when using this annotation, the default type parameter values for useEstimateGas result in the result `data` param being of `unknown` type instead of bigint
    if (transferMode === 'nativeTokenTransfer') return unsafeRawSendTransactionParamsForNativeTokenTransfer; else return undefined;
  }, [transferMode, unsafeRawSendTransactionParamsForNativeTokenTransfer]);
  const estimateGasForNativeTokenTransfer = useMemoObject(useEstimateGas(estimateGasParamsForNativeTokenTransfer), ['data', 'status', 'fetchStatus', 'error', 'refetch']); // WARNING the object returned by useEstimateGas is unconditionally recreated each render and so we use useMemoObject to stabilize the reference

  const sendTransactionParamsForNativeTokenTransfer = useMemo((): Parameters<typeof useSendTransaction>[0] => { // here we must memoize sendTransactionParamsForNativeTokenTransfer so that a new object isn't created each render which would cause useSendTransaction to return a new value each render and trigger unnecessary status updates, which can then cause infinite render loops if an ancestor component rerenders each status update.
    return {
      mutation: {
        onSuccess: onTransactionSigned,
      },
    };
  }, [onTransactionSigned]);
  const sendTransactionForNativeTokenTransfer = useMemoObject(useSendTransaction(sendTransactionParamsForNativeTokenTransfer), ['sendTransaction', 'data', 'status', 'error', 'reset']); // WARNING the object returned by useSendTransaction is unconditionally recreated each render and so we use useMemoObject to stabilize the reference
  // TODO warning are 'sendTransaction', 'data', 'error' stable across renders?

  const stntt = sendTransactionForNativeTokenTransfer.sendTransaction; // allow hook dependency to be only on sendTransaction instead of entire object
  const { isSuccess: egnttisSuccess, data: egnttData } = estimateGasForNativeTokenTransfer; // allow hook dependency to be only on isSuccess and data instead of entire object
  const executeSendTransactionForNativeTokenTransfer = useMemo((): (() => void) | undefined => {
    if (egnttisSuccess) return () => stntt({
      ...unsafeRawSendTransactionParamsForNativeTokenTransfer,
      gas: egnttData,
    });
    else return undefined;
  }, [unsafeRawSendTransactionParamsForNativeTokenTransfer, egnttisSuccess, egnttData, stntt]);
  // @eslint-no-use-below[stntt]
  // @eslint-no-use-below[egnttisSuccess]
  // @eslint-no-use-below[egnttData]
  // ********** END hooks used only for native currency transfers (and not token transfers or native currency transfers using the proxy) **********

  // ********** BEGIN hooks used only for native currency transfers using the proxy (and not token transfers or native currency transfers without the proxy) **********
  const simulateContractParamsForNativeTokenTransferProxy = useMemo((): Parameters<typeof useSimulateContract<typeof ETHTransferProxyABI, 'transferETH', readonly [`0x${string}`]>>[0] => { // here we must memoize so that a new object isn't created each render which would cause useSimulateContract to return a new value each render and trigger unnecessary status updates, which can then cause infinite render loops if an ancestor component rerenders each status update.
    if (transferMode === 'nativeTokenTransferProxy') return {
      chainId: cachedTT.token.chainId,
      address: nativeTokenTransferProxyContractAddress,
      abi: ETHTransferProxyABI,
      functionName: 'transferETH',
      args: [cachedTT.receiverAddress],
      value: cachedTT.amount,
    } as const; else return undefined;
  }, [cachedTT, transferMode, nativeTokenTransferProxyContractAddress]);
  const simulateContractForNativeTokenTransferProxy = useMemoObject(useSimulateContract(simulateContractParamsForNativeTokenTransferProxy), ['data', 'status', 'fetchStatus', 'error', 'refetch']); // WARNING the object returned by useSimulateContract is unconditionally recreated each render and so we use useMemoObject to stabilize the reference (NB the `data` field is an object that has a stable reference across renders)

  const writeContractParamsForNativeTokenTransferProxy = useMemo((): Parameters<typeof useWriteContract>[0] => { // here we must memoize so that a new object isn't created each render which would cause useWriteContract to return a new value each render and trigger unnecessary status updates, which can then cause infinite render loops if an ancestor component rerenders each status update.
    return {
      mutation: {
        onSuccess: onTransactionSigned,
      },
    };
  }, [onTransactionSigned]);
  const writeContractForNativeTokenTransferProxy = useMemoObject(useWriteContract(writeContractParamsForNativeTokenTransferProxy), ['writeContract', 'data', 'status', 'error', 'reset']); // WARNING the object returned by useWriteContract is unconditionally recreated each render and so we use useMemoObject to stabilize the reference --> TODO actual

  const { isSuccess: wcnttIsSuccess, data: wcnttData } = simulateContractForNativeTokenTransferProxy; // allow hook dependency to be only on isSuccess and data instead of entire object
  const wcntp = writeContractForNativeTokenTransferProxy.writeContract; // allow hook dependency to be only on writeContract instead of entire object
  const executeWriteContractForNativeTokenTransferProxy = useMemo((): (() => void) | undefined => {
    if (wcnttIsSuccess) return () => wcntp(wcnttData.request);
    else return undefined;
  }, [wcnttIsSuccess, wcnttData, wcntp]);
  // @eslint-no-use-below[wcnttIsSuccess]
  // @eslint-no-use-below[wcnttData]
  // @eslint-no-use-below[wcntp]
  // ********** END hooks used only for native currency transfers using the proxy (and not token transfers or native currency transfers without the proxy) **********

  // ********** BEGIN variables that unify token and native currency hook states and provide an abstraction boundary for downstream to not know or care if cachedTT is a token or native currency transfer **********

  const prepare: Pick<Intersection<Intersection<typeof simulateContractForErc20Transfer, typeof estimateGasForNativeTokenTransfer>, typeof simulateContractForNativeTokenTransferProxy>, 'isError' | 'isPending' | 'isLoading' | 'status' | 'fetchStatus'> & {
    error: Error | null; // each underlying prepare has a different error type, so 'error' can't be included in the Intersection Pick. Instead, we unify as the supertype Error
    refetch: () => void; // useEstimateGas(...).refetch and useWriteContract(...).refetch have different type signatures and so can't be included in the Intersection Pick, but these signatures share a supertype of `() => void` so we can include that supertype manually (and that works because we don't use any of the params passable to refetch).
  } = (() => {
    switch (transferMode) {
      case 'erc20Transfer': return simulateContractForErc20Transfer;
      case 'nativeTokenTransfer': return estimateGasForNativeTokenTransfer;
      case 'nativeTokenTransferProxy': return simulateContractForNativeTokenTransferProxy;
      case 'errorNativeTokenTransferProxyRequiredButUnvailable': return simulateContractForNativeTokenTransferProxy; // NB here we know that status will be error and simulateContractParamsForNativeTokenTransferProxy was set to undefined and simulateContractForNativeTokenTransferProxy was disabled, but we return it anyway so that `prepare` is unconditionally defined
    }
  }
  )();
  const prepareIsIdle = prepare.isPending && prepare.fetchStatus === 'idle'; // tanstack query v5 removed isIdle, which is now equal to "pending and not fetching"

  // TODO in this unification section, add a permanent design note about the tanstack query v5 changes and why write uses isPending while prepare uses isLoading --> do this after it all works. remember to include both the definitions at top of this file, as well as my new `idle = isPending && fetchStatus == 'idle'`

  const write: Pick<Intersection<Intersection<typeof writeContractForErc20Transfer, typeof sendTransactionForNativeTokenTransfer>, typeof writeContractForNativeTokenTransferProxy>, 'isIdle' | 'isError' | 'isPending' | 'isSuccess' | 'data' | 'status'> & {
    error: Error | null; // each underlying write has a different error type, so 'error' can't be included in the Intersection Pick. Instead, we unify as the supertype Error
  } = (() => {
    switch (transferMode) {
      case 'erc20Transfer': return writeContractForErc20Transfer;
      case 'nativeTokenTransfer': return sendTransactionForNativeTokenTransfer;
      case 'nativeTokenTransferProxy': return writeContractForNativeTokenTransferProxy;
      case 'errorNativeTokenTransferProxyRequiredButUnvailable': return writeContractForNativeTokenTransferProxy; // NB here we know that status will be error and prepareContractWriteForNativeTokenTransferProxy will be unused because its prepare has `enabled: false`, but we return it anyway so that `write` is unconditionally defined
    }
  }
  )();

  const signAndSendTransaction: (() => void) | undefined = (() => { // useWriteContract(...).write and useSendTransaction(...).sendTransaction have different names (ie. write vs sendTransaction) so we unify them as a new local variable (ie. signAndSendTransaction) instead of including them in the `write` unification above.
    switch (transferMode) {
      case 'erc20Transfer': return executeWriteContractForErc20Transfer;
      case 'nativeTokenTransfer': return executeSendTransactionForNativeTokenTransfer;
      case 'nativeTokenTransferProxy': return executeWriteContractForNativeTokenTransferProxy;
      case 'errorNativeTokenTransferProxyRequiredButUnvailable': return undefined;
    }
  }
  )();

  const writeReset: () => void = useCallback(() => { // WARNING here we define writeReset to reset underlying wagmi hooks for all transfer modes to ensure that all actually get reset when a reset is executed. If we instead added 'reset' to our `write` unification above and then used `write.reset`, this would be incorrect because when the client calls reset(), the active token transfer (cachedTT) is updated and this may cause the write unification to change transfer modes, and then the underlying write hook that needed to be reset (the one that was actually used prior to the reset) wouldn't be reset (because it's reset function would no longer be included in the write unification). So instead, we correctly reset all hooks here and exclude 'reset' from our write unification above.
    writeContractForErc20Transfer.reset();
    sendTransactionForNativeTokenTransfer.reset();
    writeContractForNativeTokenTransferProxy.reset();
  }, [writeContractForErc20Transfer, sendTransactionForNativeTokenTransfer, writeContractForNativeTokenTransferProxy]);

  // WARNING prepareContractWrite, contractWrite, and contractWriteForNativeTokenTransferProxy have been unified into `write` and, per the following eslint rules, none should be used below here so as to create an abstraction boundary where the code below here doesn't have to know or care about which transfer mode we're using.
  // @eslint-no-use-below[prepareContractWrite]
  // @eslint-no-use-below[contractWrite]
  // @eslint-no-use-below[contractWriteForNativeTokenTransferProxy]

  // ********** END variables that unify token and native currency hook states and provide an abstraction boundary for downstream to not know or care if cachedTT is a token or native currency transfer **********

  const pe = prepare.error; // use a local variable so that the refetch useEffect's dependency is only on prepare.error and not the entire prepare object
  const pr = prepare.refetch; // use a local variable so that the refetch useEffect's dependency is only on the prepare.refetch function and not the entire prepare object
  useEffect(() => {
    if (isEphemeralPrepareError(pe)) {
      pr(); // NB refetches are run back-to-back with no backoff or maximum refetch limit. In every case I tested, it took only a single refetch to clear the ephemeral error.
    }
  }, [pe, pr]);
  // @eslint-no-use-below[pe]
  // @eslint-no-use-below[pr]

  const transactionFeeUnaffordableErrorFromPrepare: TransactionFeeUnaffordableError | undefined = useMemo(() => tryMakeTransactionFeeUnaffordableError(prepare.error), [prepare.error]);

  const userRejectedTransactionSignRequest: boolean = isUserRejectedTransactionSignRequestError(write.error);

  const transactionFeeUnaffordableErrorFromWrite: TransactionFeeUnaffordableError | undefined = useMemo(() => tryMakeTransactionFeeUnaffordableError(write.error), [write.error]);

  const reset = useCallback<() => void>(() => {
    setRetries(0); // see note on setRetries definition. `retries` must be reset here instead of in the canonical location where all othere state is reset.
    setDoReset(true);
  }, [setDoReset]);

  const waitParams = useMemo(() => { // here we must memoize waitParams so that a new object isn't created each render which would cause useWaitForTransaction to return a new value each render and trigger unnecessary status updates, which can then cause infinite render loops if an ancestor component rerenders each status update.
    return {
      chainId: cachedTT.token.chainId,
      hash: write.data, // NB auto-sets `enabled:false` iff write.data is undefined
      confirmations: props.confirmationsBeforeSuccess === undefined ? 1 : props.confirmationsBeforeSuccess,
    };
  }, [props.confirmationsBeforeSuccess, cachedTT.token.chainId, write.data]);

  const wait = useWaitForTransactionReceipt(waitParams);
  useEffect(() => { // tanstack query v5 removed onSuccess for good reasons (https://tkdodo.eu/blog/breaking-react-querys-api-on-purpose#react-query-v5), so we simulate it here using an effect handler. NB we don't want our local state machine to rely on `wait.data` as `wait` can sometimes reset itself (such as on chain switch)
    if (wait.data && transactionReceipt === undefined) {
      setTransactionReceipt(wait.data);
      setIsSuccess(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- here we only want to run this hook when the transaction receipt may have become available
  }, [wait.data]);
  const waitError = wait.error;
  const waitIsLoading = wait.isLoading || (wait.isSuccess && transactionReceipt === undefined); // WARNING here we must also compute the loading state when (wait is successful but transactionReceipt is still undefined), and not just when waitIsLoading, because transactionReceipt is set asynchronously in an effect handler, so there will be one or more renders where waitIsLoading is false (as wait.data became available) but transactionReceipt has not been set yet by its effect handler

  const waitIsIdle = wait.isPending && wait.fetchStatus === 'idle'; // tanstack query v5 removed isIdle, which is now equal to "pending and not fetching"
  // @eslint-no-use-below[wait] WARNING we observed that sometimes `wait` can reset itself (such as on chain switch), so we cache `wait.data` into state transactionReceipt and isSuccess. So, it's unsafe to use wait.isSuccess or wait.data below here (as they may be desynced from transactionReceipt and isSuccess, which are set asynchronously), but eslint-no-use-below only supports variables and not their fields, so we disallow any use of wait

  const transactionFeeUnaffordableError: TransactionFeeUnaffordableError | undefined = useMemo(() => {
    if (transactionFeeUnaffordableErrorFromPrepare && transactionFeeUnaffordableErrorFromWrite) console.error("Unexpected error state: both transactionFeeUnaffordableErrorFromPrepare and transactionFeeUnaffordableErrorFromWrite are defined, but we expected at most one to be defined");
    return transactionFeeUnaffordableErrorFromPrepare || transactionFeeUnaffordableErrorFromWrite;
  }, [transactionFeeUnaffordableErrorFromPrepare, transactionFeeUnaffordableErrorFromWrite]);

  const switchChainOnSuccess = useCallback<() => void>(() => {
    setAutoExecuteState("finishedSwitchingChainAndShouldAutoExecute");

  }, [setAutoExecuteState]);

  const switchChainOnError = useCallback<(err: SwitchChainErrorType) => void>(() => {
    // The user rejected the chain switch or another error occurred. We'll set autoExecuteState to none, and if the user retries execution and accepts the chain switch, that retry will set autoExecuteState back to clickedExecuteAndStartedSwitchingChain, and then we'll then auto-execute the transaction signing. Note that we must set autoExecuteState to "none" here otherwise (having rejected/failed this chain switch) if the user switches chains manually in their wallet, the transaction will auto-execute despite the user having not clicked the button to switch chains, which is a jarring experience - the transaction confirmation pops up out of nowhere.
    setAutoExecuteState("none");
  }, [setAutoExecuteState]);

  const switchChainParams = useMemo((): Parameters<typeof useSwitchChain>[0] => { // TODO NB these don't need to be rm'd instead likely move onSuccess/onError callbacks from executeChainSwitch to here
    return {
      // mutation: {
      //   onSuccess: () => console.log("ry switchChain onSuccess"), // TODO rm console and --> likely move onSuccess/onError callbacks from executeChainSwitch to here
      //   onError: (err) => console.log("ry switchChain onError", err), // TODO rm console and --> likely move onSuccess/onError callbacks from executeChainSwitch to here
      // },
    };
  }, []);

  const switchChain = useMemoObject(useSwitchChain(switchChainParams), ['switchChain', 'data', 'status', 'error', 'reset']);  // WARNING the object returned by useSwitchChain is unconditionally recreated each render and so we use useMemoObject to stabilize the reference
  // TODO are switchChain, data, error actually stable across renders?

  const swsw = switchChain.switchChain; // allow hook dependency to be only on switchChain.switchChain instead of entire object
  const executeChainSwitch = useCallback<() => void>(() => {
    swsw({
      chainId: cachedTT.token.chainId,
    }, {
      onSuccess: switchChainOnSuccess,
      onError: switchChainOnError,
    });
  }, [cachedTT.token.chainId, swsw, switchChainOnError, switchChainOnSuccess]);
  // @eslint-no-use-below[swsw]

  const shouldAutoRetry: boolean = (() => {
    const isErrorRetryable: boolean = isRetryableError(prepare.error) || isRetryableError(write.error) || isRetryableError(waitError) || isRetryableError(switchChain.error); // an error is said to be "retryable" (instead of fatal) if we want to automatically reset the button and automatically retry again
    return isErrorRetryable && !isMaxRetriesExceeded;
  })();

  useEffect(() => {
    if (shouldAutoRetry && !willAutoRetry) {
      setWillAutoRetry(true);
      setRetries(n => n + 1);
      setDoReset(true)
    }
  }, [setWillAutoRetry, setRetries, willAutoRetry, shouldAutoRetry]);

  const autoRetryInProgress: boolean = shouldAutoRetry || willAutoRetry;

  const [executeCalledAtLeastOnce, setExecuteCalledAtLeastOnce] = useState(false);

  const swr = switchChain.reset; // use a local variable so that the reset useEffect's dependency is only on the switchChain.reset function and not the entire switchChain object
  useEffect(() => {
    if (doReset) {
      // WARNING here we must update all state to initial values; if state is added/changed, we must also reset it here.
      // WARNING however, here we do not clear retries (ie. we dont call setRetries) as retries is persisted across resets.
      setCachedTT(props.tt);
      setIsSuccess(false);
      setSignedTransaction(undefined);
      setAutoExecuteState(willAutoRetry && executeCalledAtLeastOnce && !isSuccess ? "autoRetry" : "none"); // here, we will auto-execute due to autoRetry iff we've just reset due to an auto retry and also the user clicked the button at least once since the previous retry and also we check !isSuccess as an extra sanity to help ensure we don't auto-execute a double-spend. WARNING the latter clause of not auto-executing unless the user clicked the button at least once is crucial because there certain useSimulateContract(...).errors are retryable, and so if we were to auto-execute without the condition of user having clicked button, we would be sending a transaction the user didn't actually request (eg. button loads -> prepare emits retryable error -> reset -> autoRetry -> auto-execute -> now we've executed without the user ever having clicked the button, which is particularly bad for wallets like web3auth that auto-approve any suggestion transactions, so we'd be sending money without the user ever having approved it!)
      setWillAutoRetry(false);
      setTransactionReceipt(undefined);
      writeReset();
      swr();
      setExecuteCalledAtLeastOnce(false);
      setDoReset(false);
    }
  }, [props.tt, setCachedTT, setIsSuccess, isSuccess, setSignedTransaction, setAutoExecuteState, setTransactionReceipt, writeReset, swr, setExecuteCalledAtLeastOnce, executeCalledAtLeastOnce, setDoReset, doReset, willAutoRetry, setWillAutoRetry]);
  // @eslint-no-use-below[swr] swr is a local variable intended only to help optimize the above hook

  const needToSwitchChain: boolean =
    isChainMismatchError(prepare.error) // ie. wagmi's API is that prepare.error is a chain mismatch error if and only if the wallet's active chain differs from the chainId passed to prepare.
    || activeChain === undefined // activeChain will be undefined if the wallet has an unsupported chain selected
    || (activeChain.id !== cachedTT.token.chainId) // in certain cases, the active chain may not be the token's chain while wagmi's prepare.error is null. For example, this can happen if props.tt.token.chainId is recached after a successful prepare without reseting write. NB wagmi's hooks aren't particularly resilient to changes in props.tt, so we currently don't support automatic changes to props.tt (by way of caching its first value into cachedTT), so rn, we don't expect this conditional branch to ever be true because prepare.error should be ChainMismatchError unless activeChain==token.chainId, but we kept the conditional branch code anyway because it's knowlege and probably more correct.

  const writeIsPending = write.isPending; // allow useMemo hook dep to be on write.isPending instead of write;
  const execute: () => void = useCallback(() => { // status will be ReadyToExecute only if the user may prompt a programmatic chain switch or sign the transaction. So, here we construct an execute function to run these actions. NB it may be invalid to run this execute because we would be in any status (such as Error), but we construct execute here because hooks must be run unconditionally
    // TODO consider deferred execution of execute() using a technique simlar to setDoReset(true). Something like `{ if (doExecute) console.warn('execute already in progress'); else if (doReset) console.warn('can't execute during a reset'); else setDoExecute(true); }` --> but how would deferred execution interact with resets? The `if (doReset)` can't guarantee that a reset hasn't occurred by the time execution takes place, it would depend on effect hook orders. As well, if a client requests a reset, they expect to get it -- would a reset be skipped if execution is pending? --> the main benefit of deferred execution is to prevent clients from calling a damaging execute() on a stale status. Eg. execute() on a stale status will cause the wallet to try and sign a stale transaction. But rn, the only client of execute() is our internal button library, so this doesn't seem like a valuable change.

    setExecuteCalledAtLeastOnce(true);
    if (!isConnected) {
      console.error("ExecuteTokenTransfer: execute() called when wallet not connected");
    } if (needToSwitchChain && executeChainSwitch) {
      setAutoExecuteState("clickedExecuteAndStartedSwitchingChain");
      executeChainSwitch();
    } else if (signAndSendTransaction && !writeIsPending) { // here we protect against redundant calls to write.write by ensuring that we call write.write only if write isn't loading. This helps to make execute idempotent so that if client calls it repeatedly for any reason, we don't end up throws errors or in an error state. (NB we might be tempted to check write.isIdle here instead of write.isPending, but that's incorrect because if the user already rejected the transaction, write.isIdle is false and write.error is an instanceof UserRejectedRequestError.)
      setAutoExecuteState("none");
      signAndSendTransaction();
    } else throw new Error(`ExecuteTokenTransfer: unexpected execute()`);
  }, [isConnected, setAutoExecuteState, needToSwitchChain, executeChainSwitch, signAndSendTransaction, writeIsPending]);
  // @eslint-no-use-below[executeChainSwitch] executeChainSwitch has been handled and is not intended to be used below here

  const isEverythingIdle: boolean = prepareIsIdle && write.isIdle && waitIsIdle && switchChain.isIdle; // NB wagmi seems to return all hooks idle and not loading on first render/component mount. Ie. prepare.isLoading is false on the initial render (and write.isPending and waitIsLoading are also false), so we'll use this flag to detect if everything is idle, and if so, we'll assign the Loading Init status.

  useEffect(() => {
    const nextStatus: ExecuteTokenTransferStatus = (() => {
      if (transferMode === 'errorNativeTokenTransferProxyRequiredButUnvailable') {
        const s: ExecuteTokenTransferStatus = {
          activeTokenTransfer: cachedTT,
          reset,
          status: 'Error',
          isError: true,
          error: new NativeTokenTransferProxyRequiredButUnvailableError(cachedTT.token.chainId),
          isReadyToExecute: false,
          executeCalledAtLeastOnce,
          isLoading: false,
          needToSwitchChainManually: false,
          isSuccess: false,
        };
        return s;
      } else if (isSuccess) {
        if (signedTransaction && transactionReceipt) { // NB here we compute Success status regardless of whether or not the wallet is connected. This is because wagmi's wait hook is able to monitor for confirmation even if the user's wallet disconnects or the wallet's active chain changes. So by computing Succcess status regardles of wallet connection/active chain, we're being more useful to the client. Also see design note on isSuccess definition.
          const s: ExecuteTokenTransferStatus = {
            activeTokenTransfer: cachedTT,
            reset,
            status: 'Success',
            isError: false,
            isReadyToExecute: false,
            executeCalledAtLeastOnce: true,
            isLoading: false,
            needToSwitchChainManually: false,
            signedTransaction,
            isSuccess: true,
            successData: transactionReceipt,
          };
          return s;
        } else if (!signedTransaction) {
          // status is success but signedTransaction is unexpectedly undefined (and possibly transactionReceipt, too)
          const s: ExecuteTokenTransferStatus = {
            activeTokenTransfer: cachedTT,
            reset,
            status: 'Error',
            isError: true,
            error: Error(`Signed Transaction Missing On Success`),
            isReadyToExecute: false,
            executeCalledAtLeastOnce,
            isLoading: false,
            needToSwitchChainManually: false,
            isSuccess: false,
          };
          return s;
        } else {
          // status is success, transactionReceipt missing
          const s: ExecuteTokenTransferStatus = {
            activeTokenTransfer: cachedTT,
            reset,
            status: 'Error',
            isError: true,
            error: Error(`Receipt Missing On Success`),
            isReadyToExecute: false,
            executeCalledAtLeastOnce,
            isLoading: false,
            needToSwitchChainManually: false,
            signedTransaction,
            isSuccess: false,
          };
          return s;
        }
      } else if (!autoRetryInProgress && (
        (prepare.error
          && !isChainMismatchError(prepare.error)
          && !isEphemeralPrepareError(prepare.error)
        ) || (write.error && !userRejectedTransactionSignRequest)
        || waitError
      )) {
        const errorToIncludeInStatus: Error = (() => {
          if (transactionFeeUnaffordableError) return transactionFeeUnaffordableError; // WARNING here we must prioritize transactionFeeUnaffordableError which is derived from prepare or write errors. If we prioritized write/prepare errors, then we would be losing from the status the information that the user can't afford the transaction fee.
          else if (waitError) return waitError; // similarly, here we prioritize a wait error over write/prepare errors, so that if the user has signed a transaction, we are reporting any error on that confirmation and don't lose information eg. to a new prepare error due to a new chain switch.
          else if (write.error) return write.error; // similarly, here we prioritize a write error over a prepare error, so that if the user signed a transaction, we report any error on that signature and not don't lose information eg. to a new prepare error due to a new chain switch.
          else if (prepare.error) return prepare.error;
          else throw new Error(`Unexpected`); // we expect this to be unreachable because we're only in this condition branch if at least one of prepare/write/wait errors are defined
        })();
        const s: ExecuteTokenTransferStatus = {
          activeTokenTransfer: cachedTT,
          reset,
          status: 'Error',
          isError: true,
          error: errorToIncludeInStatus,
          isReadyToExecute: false,
          executeCalledAtLeastOnce,
          isLoading: false,
          needToSwitchChainManually: false,
          ...(signedTransaction && { signedTransaction } satisfies Pick<ExecuteTokenTransferStatus, 'signedTransaction'>),
          isSuccess: false,
        };
        return s;
      } else if (
        !isConnected // below we'll compute a status of Loading - Init when the wallet isn't connected as a way to gracefully degrade since we can't transfer a token without a connected wallet
        || prepare.isLoading
        || write.isPending
        || waitIsLoading
        || switchChain.isPending
        || isEverythingIdle // NB see note on isEverythingIdle definition 
        || autoRetryInProgress
        || isEphemeralPrepareError(prepare.error)
      ) {
        const loadingStatus: NonNullable<ExecuteTokenTransferStatus['loadingStatus']> = (() => {
          if (prepare.isLoading
            || !isConnected
            || isEverythingIdle // NB see note on isEverythingIdle definition 
            || autoRetryInProgress
            || isEphemeralPrepareError(prepare.error)
          ) return 'Init';
          else if (switchChain.isPending) return 'SwitchingChain';
          else if (write.isPending) return 'SigningTransaction';
          else if (waitIsLoading) return 'ConfirmingTransaction';
          else throw new Error(`ExecuteTokenTransfer: unexpected loading status`);
        })();
        if (loadingStatus === 'ConfirmingTransaction') {
          if (signedTransaction) {
            const s: ExecuteTokenTransferStatus = {
              activeTokenTransfer: cachedTT,
              reset,
              status: 'Loading',
              isError: false,
              isReadyToExecute: false,
              executeCalledAtLeastOnce,
              isLoading: true,
              loadingStatus: 'ConfirmingTransaction',
              needToSwitchChainManually: false,
              signedTransaction,
              isSuccess: false,
            };
            return s;
          } else {
            const s: ExecuteTokenTransferStatus = {
              activeTokenTransfer: cachedTT,
              reset,
              status: 'Error',
              isError: true,
              error: Error(`Signed Transaction Missing When Confirming Transaction`),
              isReadyToExecute: false,
              executeCalledAtLeastOnce,
              isLoading: false,
              needToSwitchChainManually: false,
              isSuccess: false,
            };
            return s;
          }
        } else {
          const s: ExecuteTokenTransferStatus = {
            activeTokenTransfer: cachedTT,
            reset,
            status: 'Loading',
            isError: false,
            isReadyToExecute: false,
            executeCalledAtLeastOnce,
            isLoading: true,
            loadingStatus,
            needToSwitchChainManually: false,
            isSuccess: false,
          };
          return s;
        }
      } else if (needToSwitchChain && (
        // need to switch chain manually if there was a fatal switch chain error. Right now, nonfatal chain switch errors come in two flavors: 1) the user rejecting the chain switch or 2) our manual detection of nonfatal errors in isChainSwitchNonFatalError
        switchChain.error
        && !(switchChain.error instanceof UserRejectedRequestError)
        && !isChainSwitchNonFatalError(switchChain.error)
      )) {
        const s: ExecuteTokenTransferStatus = {
          activeTokenTransfer: cachedTT,
          reset,
          status: 'NeedToSwitchChainManually',
          isError: false,
          isReadyToExecute: false,
          executeCalledAtLeastOnce,
          isLoading: false,
          needToSwitchChainManually: true,
          isSuccess: false,
        };
        return s;
      } else if (needToSwitchChain || signAndSendTransaction !== undefined) { // NB since `execute` is defined unconditionally, instead we rely on this condition to determine if actually we're ready to execute
        const s: Writable<ExecuteTokenTransferStatus> = {
          activeTokenTransfer: cachedTT,
          reset,
          status: 'ReadyToExecute',
          isError: false,
          isReadyToExecute: true,
          execute,
          executeCalledAtLeastOnce,
          isLoading: false,
          needToSwitchChainManually: false,
          isSuccess: false,
        };
        if (userRejectedTransactionSignRequest) {
          s.warning = 'UserRejectedTransaction';
        } else if (isUserRejectedChainAddError(switchChain.error)) {
          s.warning = 'UserRejectedChainAdd';
        } else if (
          (switchChain.error && switchChain.error instanceof UserRejectedRequestError)
        ) {
          s.warning = 'UserRejectedChainSwitch';
        } else if (isChainSwitchNonFatalError(switchChain.error)) {
          s.warning = 'ChainSwitchNonFatalError';
        }
        if (
          autoExecuteState === "finishedSwitchingChainAndShouldAutoExecute"
          || autoExecuteState === "autoRetry"
        ) {
          s.suggestAutoExecute = true;
        }
        return s;
      } else {
        // here we failed to compute the next status because our state machine (ie. if statement) doesn't handle the current values of state variables. Previously we threw an error here, but that will escalate the problem to the nearest error boundary, whereas it's probably better UX for the button to stay where it is and display an error normally, which is what this error status does:
        const s: ExecuteTokenTransferStatus = {
          activeTokenTransfer: cachedTT,
          reset,
          status: 'Error',
          isError: true,
          error: Error(`Internal`),
          isReadyToExecute: false,
          executeCalledAtLeastOnce,
          isLoading: false,
          needToSwitchChainManually: false,
          ...(signedTransaction && { signedTransaction } satisfies Pick<ExecuteTokenTransferStatus, 'signedTransaction'>),
          isSuccess: false,
        };
        return s;
      }
    })();
    setStatus(nextStatus); // design note: in general, nextStatus may be identical to the current status cached by clients. This is because there's a loss of information between this useEffect's dependencies when computing nextStatus. For example, [edit: note that the following example is no longer true as of wagmi v2 because switchChain.switchChain is now unconditionally defined, however we kept the example becuase the spirit is still correct] if switchChain becomes defined, we will compute nextStatus, but both the current and next status may have nothing to do with switchChain being defined or not. In fact, this is exactly what usually happens when this component initializes: switchChain.switchChain is initially undefined, and it becomes defined shortly after mounting [edit: again, this is no longer true as of wagmi v2], which triggers computation of nextStatus, but both the current status and nextStatus are "Loading - Init", so we know we're usually sending a redundant nextStatus to the client. If we wanted to fix this, a good way to do so may be to do a deep comparison of ObservableValue.getCurrentValue vs. nextStatus in ExecuteTokenTransferButton, and skip calling setValueAndNotifyObservers if the current and next statuses are equal. A good deep comparison library is fast-deep-equal, it is both fast and relatively small (13kb), but that's still an extra 13kb of bundle size. But currently, we think it's better to shave 13kb off the bundle size vs. avoiding a few unnecessary rerenders that React handles instantly and without any UI jank/disruptions because the shadow DOM diff interprets the redundant status update as a no-op, so that's why right now, nextStatus may be identical to the current status cached by clients.
  }, [setStatus, isConnected, cachedTT, transferMode, prepare.error, write.error, waitError, switchChain.error, prepare.isLoading, write.isPending, waitIsLoading, switchChain.isPending, isEverythingIdle, needToSwitchChain, execute, reset, transactionReceipt, isSuccess, signedTransaction, signAndSendTransaction, autoExecuteState, userRejectedTransactionSignRequest, transactionFeeUnaffordableError, executeCalledAtLeastOnce, autoRetryInProgress]);

  useEffect(() => { // when this component unmounts, send a final undefined status so the client knows that any defined status is stale
    return () => setStatus(undefined);
  }, [setStatus]);

  return null;
}

// isUserRejectedChainAddError returns true iff the passed Error
// represents the user having rejected a request to add a chain. The
// error passed must be sourced from `useSwitchChain(...).error` or
// behaviour is undefined.
// TODO WARNING is useSwitchChain().error still set to any error surfaced by switchChain.switchChain()?
function isUserRejectedChainAddError(e: Error | undefined | null): boolean {
  // WARNING errors passed into this function can come from a variety of upstream sources, and they may not confirm to the TypeScript typeof Error, which is why we do extra checking to ensure properties exist before we read them.
  if (e === undefined || e === null) return false;
  else {
    const userRejectionCause: object | undefined = e instanceof UserRejectedRequestError && typeof e.cause === 'object' && e.cause !== null ? e.cause : undefined;
    const userRejectionCauseMessage: string | undefined = hasOwnPropertyOfType(userRejectionCause, 'message', 'string') ? userRejectionCause.message : undefined;
    if (
      (userRejectionCauseMessage && userRejectionCauseMessage.includes('Unrecognized chain')) // MetaMask browser extension. Explanation: when the user rejects auto-add of a chain, wagmi returns the same error (switchChain.error: UserRejectedRequestError) as when the user rejects auto-switch of a chain. But, we can distinguish between rejection of a chain add vs. switch by looking for the "Unrecognized chain" in the Error cause which is sourced from MetaMask browser extension. For reference, here's the full message on reject add as returned by the metamask browser extension: `Unrecognized chain ID "0x66eed". Try adding the chain using wallet_addEthereumChain first.`
      // TODO support more wallets
    ) return true;
    else return false;
  }
}

// isUserRejectedTransactionSignRequestError returns true iff the passed
// Error represents the user having rejected a request to sign a
// transaction. The error passed must be sourced from
// `useWriteContract(...).error` or behaviour is undefined.
function isUserRejectedTransactionSignRequestError(e: Error | undefined | null): boolean {
  // WARNING errors passed into this function can come from a variety of upstream sources, and they may not confirm to the TypeScript typeof Error, which is why we do extra checking to ensure properties exist before we read them.
  if (e === undefined || e === null) return false;
  else if (
    (e instanceof UserRejectedRequestError) // for some popular/old wallets (such as metamask browser extension), wagmi supports mapping the underlying wallet error into a typed error.
    // for other wallets, wagmi doesn't support mapping the underlying wallet error into a typed error, so we must check the error message:
    || (hasOwnPropertyOfType(e, 'message', 'string') && e.message.includes('User rejected')) // Slingshot mobile wallet with walletconnect v2
  ) return true;
  else return false;
}

// isChainSwitchNonFatalError returns true iff the passed Error
// represents a non-fatal error when attempting to switch the chain. The
// error passed must be sourced from `useSwitchChain(...).error` or
// behaviour is undefined.
// TODO WARNING is useSwitchChain().error still set to any error surfaced by switchChain.switchChain()?
function isChainSwitchNonFatalError(e: Error | undefined | null): boolean {
  // WARNING errors passed into this function can come from a variety of upstream sources, and they may not confirm to the TypeScript typeof Error, which is why we do extra checking to ensure properties exist before we read them.
  if (e === undefined || e === null) return false;
  else {
    const switchChainErrorCause: object | undefined = e instanceof SwitchChainError && typeof e.cause === 'object' && e.cause !== null && e.cause !== undefined ? e.cause : undefined; // for some popular wallets (such as metamask browser extension), wagmi supports mapping the underlying wallet error into a typed error. Currently, all non-fatal errors we detect are SwitchChainError
    const switchChainErrorCauseMessage: string | undefined = hasOwnPropertyOfType(switchChainErrorCause, 'message', 'string') ? switchChainErrorCause.message : undefined;
    if (
      (switchChainErrorCauseMessage && switchChainErrorCauseMessage.includes('already pending')) // metamask returns this if another chain switch modal is already pending when the chain switch is attempted
    ) return true;
    else return false;
  }
}

// isRetryableError returns true iff the passed Error represents an
// error that indicates the entire transaction should be automatically
// retried (ie. by reseting the transfer).
function isRetryableError(e: Error | undefined | null): boolean {
  // WARNING errors passed into this function can come from a variety of upstream sources, and they may not confirm to the TypeScript typeof Error, which is why we do extra checking to ensure properties exist before we read them.
  if (e === undefined || e === null) return false;
  else {
    const errString: string = `${serialize(e)} ${hasOwnPropertyOfType(e, 'message', 'string') ? e.message : ''}`; // search the error as a string instead of digging into structured properties because the errString method is simpler and perhaps more robust in that if the error's data structure changes but the message doesn't change, searching the errString still works but structured properties would fail. WARNING serialize doesn't always include all error properties, so we include certain properties manually.
    if (errString.includes('max fee per gas less than block base fee')) return true; // web3auth+arbitrum and metamask+all chains return this error if the signed transaction's maxFeePerGas is less than the current block's base fee. This can occur if the chain's base fee has risen rapidly since the transaction was signed and the maxFeePerGas (automatically set internally in wagmi+wallet) becomes less than the new base fee. For example, arbitrum's fast block times can enable the base fee to sometimes rise very rapidly.
    else if (errString.includes('fee cap less than block base fee')) return true; // web3auth+goerli returns this error if the signed transaction's maxFeePerGas is less than the current block's base fee. This can occur if the chain's base fee has risen rapidly since the transaction was signed and the maxFeePerGas (automatically set internally in wagmi+wallet) becomes less than the new base fee.
    else if (errString.includes('intrinsic gas too low')) return true; // metamask+arbitrum can return this error if the signed transaction's maxFeePerGas (??) is less than the current block's base fee. This can occur if the chain's base fee has risen rapidly since the transaction was signed and the maxFeePerGas (automatically set internally in wagmi+wallet) becomes less than the new base fee.
    else return false;
  }
}

// isEphemeralPrepareError returns true iff the passed Error indicates
// useSimulateContract or useEstimateGas failed for ephemeral reasons
// and can be immediately retried by way of being refetch()'d. Ephemeral
// errors are typically entirely local and don't involve network
// operations as they are retried an infinite number of times with no
// backoff. An example kind of ephemeral error would be a race condition
// in a module dependency. Not to be confused with isRetryableError. The
// error passed must be sourced from `useSimulateContract(...).error` or
// `useEstimateGas(...).error` or behaviour is undefined.
function isEphemeralPrepareError(e: Error | undefined | null): boolean {
  // WARNING errors passed into this function can come from a variety of upstream sources, and they may not confirm to the TypeScript typeof Error, which is why we do extra checking to ensure properties exist before we read them.
  if (e === undefined || e === null) return false;
  else {
    const errString: string = `${serialize(e)} ${hasOwnPropertyOfType(e, 'message', 'string') ? e.message : ''}`;  // search the error as a string instead of digging into structured properties because the errString method is simpler and perhaps more robust in that if the error's data structure changes but the message doesn't change, searching the errString still works but structured properties would fail. WARNING serialize doesn't always include all error properties, so we include certain properties manually.
    if (errString.includes('Chain') && errString.includes('not configured for connector') && errString.includes('web3auth')) return true; // web3auth returns this when switching chains because there's a race condition inside web3auth where connector.switchChain returns before the chain has actually been successfully switched.
    else return false;
  }
}

// isChainMismatchError returns true iff the passed Error indicates that
// useSimulateContract failed because the connected account's active
// chain did not match the transaction's chainId passed to prepare. The
// error passed must be sourced from `useSimulateContract(...).error` or
// behaviour is undefined.
function isChainMismatchError(e: Error | undefined | null): boolean {
  // WARNING errors passed into this function can come from a variety of upstream sources, and they may not confirm to the TypeScript typeof Error, which is why we do extra checking to ensure properties exist before we read them.
  if (e === undefined || e === null) return false;
  else {
    if (
      // eslint-disable-next-line rulesdir/no-instanceof-ChainMismatchError
      (e instanceof ChainMismatchError) // canonically and usually, a chain mismatch error is correctly an instanceof ChainMismatchError.
      || (hasOwnPropertyOfType(e, 'name', 'string') && e.name === 'ChainMismatchError') // however, sometimes a chain mismatch error can be an object that isn't an instanceof ChainMisMatchErorr and instead has a name property with the value 'ChainMismatchError'. TODO file this bug in wagmi --> a reproduction might be found using our DemoAccountProvider mock addresses.
    ) return true;
    else return false;
  }
}

// isTransactionFeeUnaffordableError returns an instance of
// TransactionFeeUnaffordableError iff the passed Error represents the user
// being unable to afford to pay the transaction fee for a particular token
// transfer. If a TransactionFeeUnaffordableError is returned, its `cause`
// is set to the passed error. Note that for some wallets, fee
// unaffordability is detected during useSimulateContract, and for
// other wallets, fee unaffordability is not detected until
// useWriteContract, and so the error passed may be sourced from
// useSimulateContract or useWriteContract (and possibly for some
// future wallets we haven't yet investigated, possibly as late as
// useWaitForTransaction following a successul write). 
function tryMakeTransactionFeeUnaffordableError(e: Error | undefined | null): TransactionFeeUnaffordableError | undefined {
  // WARNING errors passed into this function can come from a variety of upstream sources, and they may not confirm to the TypeScript typeof Error, which is why we do extra checking to ensure properties exist before we read them.
  if (e === undefined || e === null) return undefined;
  else if (
    (hasOwnPropertyOfType(e, 'stack', 'string') && e.stack.includes("insufficient funds for gas")) // MetaMask browser extension returns this as useSimulateContract(...).error
    || (hasOwnPropertyOfType(e, 'message', 'string') && e.message.includes('Failed to sign transaction')) // Coinbase Wallet on mobile with 3c on desktop (using Coinbase's version of walletconnect) returns this as useWriteContract(...).error. WARNING this error is overly general and may catch other kinds of Coinbase transaction signing errors. For example, currently, signing an affordable transaction on a chain that's not directy supported by Coinbase also fails with this error  (eg. Pay 10 USDC on Arbitrum Goerli with sufficient ETH to pay the fee also fails with this error)
    || (hasOwnPropertyOfType(e, 'data', 'object') && hasOwnPropertyOfType(e.data, 'message', 'string') && e.data.message.includes('insufficient funds')) // web3auth openloginadapter returns this as useContactWrite(...).error. Example raw error: `"{\"code\":-32603,\"data\":{\"code\":-32000,\"message\":\"INTERNAL_ERROR: insufficient funds\"}}"`
  ) return new TransactionFeeUnaffordableError("User can't afford to pay the transaction fee", e);
  else return undefined;
}

// TransactionFeeUnaffordableError represents a fatal error for a
// particular token transfer due to the user being unable to afford to
// pay the transaction fee.
export class TransactionFeeUnaffordableError extends Error {
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'TransactionFeeUnaffordableError';
    if (cause !== undefined) this.cause = cause;
  }
}

// NativeTokenTransferProxyRequiredButUnvailableError represents an
// ExecuteTokenTransfer error state where use of the native token
// transfer proxy has been specified as required but the transfer's
// chain does not have the proxy available.
export class NativeTokenTransferProxyRequiredButUnvailableError extends Error {
  readonly chainId: number;

  constructor(chainId: number) {
    super(`Native Token Transfer Proxy Required But Unavailable`);
    this.name = 'NativeTokenTransferProxyRequiredButUnvailableError';
    this.chainId = chainId;
  }
}

// ****************************************************************
// BEGIN - list of other wallet-specific or chain-specific errors that we've
// seen but haven't implemented into code:

// gasLimit set below estimated gas
//   web3auth on goerli returns "{\"code\":-32603,\"data\":{\"code\":-32000,\"message\":\"INTERNAL_ERROR: IntrinsicGas\"}}" as useWriteContract(...).error
//   web3auth on arbitrumGoerli returns {"code":-32603,"data":{"code":-32000,"message":"intrinsic gas too low"}} as useWriteContract(...).error

// END - list of other wallet-specific or chain-specific errors that we've
// seen but haven't implemented into code.
// ****************************************************************
