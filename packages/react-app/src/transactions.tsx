import { abis } from "@3cities/contracts";
import { BigNumber } from "@ethersproject/bignumber";
import { TransactionReceipt } from "@ethersproject/providers";
import { ChainMismatchError } from '@wagmi/core';
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SwitchChainError, UserRejectedRequestError, useAccount, useContractWrite, useNetwork, usePrepareContractWrite, usePrepareSendTransaction, useSendTransaction, useSwitchNetwork, useWaitForTransaction } from 'wagmi';
import { Spinner } from "./Spinner";
import { Writable } from "./Writable";
import { getSupportedChainName } from "./chains";
import { hasOwnPropertyOfType } from "./hasOwnProperty";
import { Observer, makeObservableValue, useObservedValue } from "./observer";
import { TokenTransfer, isTokenAndNotNativeCurrencyTransfer } from "./tokenTransfer";
import { PartialFor } from "./PartialFor";
import { Narrow } from "./Narrow";

// TODO build and save list of test cases to check all ExecuteTokenTransfer code paths, eg. (automatic retries, other features) X (token, native currency) X (wallets) X (networks) X (different transfer amounts including very small amounts)

// TODO s/transactions.tsx/ExecuteTokenTransfer.tsx

// TODO broken insufficient fee detection with metamask+ledger --> with ryanb.eth connected in dev, I have 0 ETH in arb goerli, but the insufficient fee funds detection isn't working. I can pop-up the write but metamask won't let me approve it. prepare is succeeding, write is in progress and pops up transaction confirmation, but then metamask pop-up says insufficient ETH to pay gas --> is this a bug in wagmi.usePrepareContractWrite?

// ExecuteTokenTransferButtonStatus represents a memoryless snapshot of the
// internal status of an ExecuteTokenTransferButton.
// ExecuteTokenTransferButton constructs these statuses internally as state
// changes and provides a callback for clients to receive the latest
// status. The status is semi-interactive and offers some functions to
// modify button state (currently just resetting the button).
export type ExecuteTokenTransferButtonStatus = Readonly<{
  activeTokenTransfer: TokenTransfer; // ExecuteTokenTransferButton does not support arbitrary ongoing changes to the props TokenTransfer. This is party because the underlying wagmi hooks don't gracefully support this, and partly because it can be bad UX to arbitrarily change an in-progress TokenTransfer. Instead, on initial render, the first TokenTransfer is cached, and subsequent updates to props TokenTransfer are ignored, unless the client calls reset(), in which case the current latest value of props TokenTransfer is recached. For convenience, this activeTokenTransfer is provided as the currently cached and active TokenTransfer. For example, a client could use activeTokenTransfer to ensure that token transfer details displayed to the user always correspond to the internal transfer details being executed.
  reset: () => void; // reset() resets the ExecuteTokenTransferButton to the initial state, and recaches the latest value of props TokenTransfer. This is useful if the client wants to change the props TokenTransfer, but doesn't want to create a new ExecuteTokenTransferButton component.
  status: 'Error' | 'InProgress' | 'NeedToSwitchNetworkManually' | 'Success';
  isError: boolean;
  error?: Error;
  inProgress: boolean;
  buttonClickedAtLeastOnce: boolean; // true iff the button was clicked at least once by the user for the current activeTokenTransfer
  needToSwitchNetworkManually: boolean;
  userIsSigningTransaction: boolean; // true iff the user is currently in the process of signing the transaction (eg. the wallet transaction confirmation pop-up is active and the user has not yet accepted or rejected the transaction).
  userSignedTransaction: boolean; // true iff the user has signed the transaction. Note that userSignedTransaction is set to true immediately after successful signing before the transaction is confirmed, and is never cleared back to false unless the client calls reset().
  isSuccess: boolean;
  successData?: TransactionReceipt;
} & ({
  status: 'Error';
  isError: true;
  error: Error;
  inProgress: false;
  buttonClickedAtLeastOnce: boolean;
  needToSwitchNetworkManually: false;
  userIsSigningTransaction: false;
  userSignedTransaction: boolean;
  isSuccess: false;
  successData?: never;
} | {
  status: 'InProgress';
  isError: false;
  error?: never;
  inProgress: true;
  buttonClickedAtLeastOnce: boolean;
  needToSwitchNetworkManually: false;
  userIsSigningTransaction: boolean;
  userSignedTransaction: boolean;
  isSuccess: false;
  successData?: never;
} | {
  status: 'NeedToSwitchNetworkManually';
  isError: false;
  error?: never;
  inProgress: false;
  buttonClickedAtLeastOnce: false;
  needToSwitchNetworkManually: true;
  userIsSigningTransaction: false;
  userSignedTransaction: false;
  isSuccess: false;
  successData?: never;
} | {
  status: 'Success';
  isError: false;
  error?: never;
  inProgress: false;
  buttonClickedAtLeastOnce: true;
  needToSwitchNetworkManually: false;
  userIsSigningTransaction: false;
  userSignedTransaction: true;
  isSuccess: true;
  successData: TransactionReceipt;
})>;

export type ExecuteTokenTransferButtonProps = {
  tt: TokenTransfer | undefined; // the token transfer this button will execute. If undefined, the button will appear to be loading forever, and the passed setStatus will never be called. WARNING ExecuteTokenTransferButton doesn't support arbitrary ongoing changes to the props TokenTransfer. See ExecuteTokenTransferButtonStatus.activeTokenTransfer.
  autoReset?: true; // if set, the button will automatically call its own status.reset to update cached token transfer details when props.tt changes, but only if the user isn't currently signing the transaction or has already signed the transaction, in which case the button is never auto-reset but can still be reset manually by the client. WARNING automatic resets trigger a new status, so clients must ensure a new status doesn't unconditionally compute new tt object, or else an infinite async render loop will occur (new tt -> auto reset -> async reset -> new status -> repeat)
  loadForeverOnTransactionFeeUnaffordableError?: true; // when the button detects that the user can't afford the transaction fee for the active token transfer, the button UI normally shows an error, but if this is set, instead will show itself as loading. When the fee is unaffordable, regardless if this set, `status.error` will be an instanceof TransactionFeeUnaffordableError, which allows the client to detect fee unaffordability and optionally, replace the active transfer with one that the user may be able to afford. The point of this flag is to enable the client to replace the active transfer on fee unaffordability without the janky intermediate UI state of the button showing an error. WARNING TransactionFeeUnaffordableError is detected on a case-by-case basis depending on the wallet's implementation, so the transaction might be (or end up being) unaffordable even if there's no error or the error isn't an instanceof TransactionFeeUnaffordableError. Ie. TransactionFeeUnaffordableError is subject to false negatives, but not false positives.
  label: string; // label to put on the button, eg. "Pay Now", "Donate Now", "Place your order"
  successLabel: string; // label to put on the button after the token transfer is successful
  disabled?: true | string; // force-disable disable the button. Pass true to disable the button. Pass a string to disable the button and display the passed string as the disabled reason. Note, the button may still be disabled for internal reasons even if this is not set.
  className?: string // className to unconditionally apply to the button element
  disabledClassName?: string // className to apply iff button is disabled
  enabledClassName?: string // className to apply iff button is enabled
  loadingSpinnerClassName?: string // className applied to the loading spinner iff button is loading. The text color is used for the loading spinner's foreground color, and the svg fill color is used for the loading spinner's background color. Recommended: set text color to same color as the disabled button label (as button is disabled during loading) and fill color to same color as button's (disabled) background color.
  errorClassName?: string // className applied to any error label
  warningClassName?: string // className applied to any warning label
  setStatus?: (status: ExecuteTokenTransferButtonStatus | undefined) => void; // callback for the client to receive updated button status. The passed status will be undefined iff ExecuteTokenTransferButton is unmounting, and this is provided to help clients avoid caching stale statuses for buttons that have been destroyed. React note: if an ancestor component of ExecuteTokenTransferButton caches this updated status as state, then ExecuteTokenTransferButton will rerender redundantly each time it updates the status (because an ancestor's subtree rerenders on state change). These redundant rerenders can be avoided by storing eg. an Observer in the ancestor and using the updated status in a cousin component (including potentially caching it as state).
};

// ExecuteTokenTransferButton is a batteries-included button to manage the
// full lifecycle of a single token transfer.
export const ExecuteTokenTransferButton: React.FC<ExecuteTokenTransferButtonProps> = ({ setStatus, ...props }) => {
  const [ov] = useState(() => makeObservableValue<ExecuteTokenTransferStatus | undefined>(undefined));

  useEffect(() => () => setStatus?.(undefined), [setStatus]); // when ExecuteTokenTransferButton unmounts, set client status to undefined to help avoid the client caching a stale status for a destroyed button

  const innerSetStatus = useCallback<((s: ExecuteTokenTransferStatus) => void)>((s: ExecuteTokenTransferStatus) => {
    // the job of this outer ExecuteTokenTransferButton component is to avoid necessary rerenders (especially not rerendering on each transfer status update) and to act as plumbing between the transfer, the client, and the UI. Here, a new status has been produced by the transfer, and so this component will push that status to the UI and the client, while leveraging ObservableValue to avoid state updates to itself:
    ov.setValueAndNotifyObservers(s);
    if (setStatus) setStatus(transferStatusToButtonStatus(s));
  }, [setStatus, ov]);

  return <>
    {props.tt === undefined || props.disabled !== undefined ? undefined : <ExecuteTokenTransfer tt={props.tt} setStatus={innerSetStatus} />}
    <ExecuteTokenTransferButtonUI {...props} observer={ov.observer} />
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
  needToSwitchNetworkManually: false,
  userSignedTransaction: false,
  isSuccess: false,
};

type ExecuteTokenTransferButtonUIProps = Pick<ExecuteTokenTransferButtonProps, 'tt' | 'autoReset' | 'loadForeverOnTransactionFeeUnaffordableError' | 'label' | 'successLabel' | 'disabled' | 'className' | 'disabledClassName' | 'enabledClassName' | 'errorClassName' | 'warningClassName' | 'loadingSpinnerClassName'> & {
  observer: Observer<ExecuteTokenTransferStatus | undefined>;
};

const ExecuteTokenTransferButtonUI: React.FC<ExecuteTokenTransferButtonUIProps> = ({ tt, autoReset, loadForeverOnTransactionFeeUnaffordableError, label, successLabel, disabled, className, disabledClassName, enabledClassName, errorClassName, warningClassName, loadingSpinnerClassName, observer, }) => {
  const { connector: activeConnector } = useAccount();
  const statusFromObserver: ExecuteTokenTransferStatus | undefined = useObservedValue(observer);
  const status = statusFromObserver || defaultExecuteTokenTransferStatus;

  const connectedWalletAutoSigns: boolean = activeConnector ? activeConnector.id.includes("web3auth") : false; // true iff the connected wallet does not ask the user to sign the transaction and instead signs it on their behalf.

  useEffect(() => {
    if (status.suggestAutoExecute) status.execute();
  }, [status]);

  useEffect(() => {
    if (autoReset && !(status.isLoading && status.loadingStatus === 'SigningTransaction') && !status.userSignedTransaction) status.reset(); // here we never want to auto-reset after the user has signed the transaction (or is currently signing it) because that would lead to a terrible UX where a payment that's already been authorized is forgotten by the button
    // eslint-disable-next-line react-hooks/exhaustive-deps -- here we don't care if status changes, all we care about is if tt changes then we should attempt an auto reset, and if we also depend on status, then we'll have both incorrect behavior (reseting on any status change) as well as an infinite reset loop (status changes -> reset -> repeat)
  }, [autoReset, tt]);

  const isButtonDisabled = (disabled !== undefined) || !status.isReadyToExecute;
  const computedClassName = `relative ${className || ''} ${isButtonDisabled ? (disabledClassName || '') : ''} ${!isButtonDisabled ? (enabledClassName || '') : ''}`;
  const computedLabel = (() => {
    const disabledReason = typeof disabled === 'string' ? disabled : undefined;
    const computedError: JSX.Element | undefined = (() => {
      if (status.error !== undefined && (status.error instanceof TransactionFeeUnaffordableError) && !loadForeverOnTransactionFeeUnaffordableError) return <span className={warningClassName || ''}>Blockchain fee unaffordable</span>;
      else if (status.error !== undefined && !(status.error instanceof TransactionFeeUnaffordableError)) return <span className={errorClassName || ''}>{` Error: ${status.error.message}`}</span>;
      else return undefined;
    })();
    const needToDismissOtherNetworkSwitch = status.warning === 'NetworkSwitchNonFatalError' ? 'Finish other network switch and retry' : undefined;
    const needToSwitchNetworkManuallyMsg = status.needToSwitchNetworkManually ? <span className={warningClassName || ''}>Switch wallet network to {getSupportedChainName(status.activeTokenTransfer.token.chainId)} ({status.activeTokenTransfer.token.chainId})</span> : undefined;
    const needToSignInWallet = status.isLoading && status.loadingStatus === 'SigningTransaction' && !connectedWalletAutoSigns ? 'Confirm in Wallet' : undefined;
    const payingInProgress = status.isLoading && (
      status.loadingStatus === 'ConfirmingTransaction'
      || (status.loadingStatus === 'SigningTransaction' && connectedWalletAutoSigns)
    ) ? 'Paying...' : undefined;
    const success = status.isSuccess ? successLabel : undefined;
    return <>{disabledReason || computedError || needToDismissOtherNetworkSwitch || needToSwitchNetworkManuallyMsg || needToSignInWallet || payingInProgress || success || label}</>;
  })();
  const computedSpinner =
    disabled === undefined // don't show loading spinner if button has been forcibly disabled by the client because even if it is loading internally, it won't be clickable until the client changes this
    && (
      status.isLoading // show loading spinner if button is loading, of course
      || (status.error !== undefined && (status.error instanceof TransactionFeeUnaffordableError) && loadForeverOnTransactionFeeUnaffordableError) // show loading spinner if the button is errored, but the error is that the transaction fee is unaffordable and the client has set the flag to indicate we should render the button as loading when fee is unaffordable (typically, the client would request this because the client will then replace the active token transfer with one that might be affordable)
    ) && <Spinner
      containerClassName="absolute top-1/2 transform -translate-y-1/2 right-4 z-10 h-6 w-6 flex items-center justify-center"
      spinnerClassName={`${loadingSpinnerClassName}`}
    />;
  const computedWarning = status.warning && <div className={`absolute top-1/2 transform -translate-y-1/2 right-4 text-sm leading-tight ${warningClassName || ''}`}>
    {(() => {
      // here we currently return the same "Rejected in wallet" warning for all warning types because I can't think of better language for network add/switch that fits within the limited space available for this warning --> TODO maybe more these warnings should be implemented in computedLabel as is NetworkSwitchNonFatalError
      switch (status.warning) {
        case 'UserRejectedTransaction':
          return <span>Rejected<br />in wallet</span>;
        case 'UserRejectedNetworkSwitch':
          return <span>Rejected<br />in wallet</span>;
        case 'NetworkSwitchNonFatalError':
          return <span></span>; // we render NetworkSwitchNonFatalError by updating computedLabel to a helpful message 
        case 'UserRejectedNetworkAdd':
          return <span>Rejected<br />in wallet</span>;
      }
    })()}
  </div>;

  return <button
    type="button"
    disabled={isButtonDisabled}
    onClick={status.execute}
    className={computedClassName}
  >
    {computedLabel}
    {computedWarning}
    {computedSpinner}
  </button>;
}

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
  status: 'Error' | 'ReadyToExecute' | 'Loading' | 'NeedToSwitchNetworkManually' | 'Success';
  isError: boolean;
  error?: Error;
  warning?: // warning is an enum of things that can go temporarily wrong but don't block the transfer from potentially eventually succeeding. Warnings are set as they occur, and may or may not be eventually cleared (set to undefined) or overwritten with a new warning
  'UserRejectedNetworkAdd' // the user had to switch network, but the user's wallet doesn't yet have this network, and wagmi asked the user to add the network, but the user rejected the network add.
  | 'UserRejectedNetworkSwitch' // the user had to switch network, the switch was offered to the user, but the user rejected the network switch. 
  | 'NetworkSwitchNonFatalError' // the user had to switch network, and the ExecuteTokenTransfer component attempted to launch the switch network prompt, but there was a non-fatal error, usually a prior switch network prompt is still active, so the user should close the old network switch prompts and retry.
  | 'UserRejectedTransaction' // the user rejected signing the transaction.
  isReadyToExecute: boolean;
  execute?: () => void; // iff defined, the client can call execute() to move the token transfer forward. In practice, calling execute() triggers a network add, network switch, or transaction confirmation in the user's wallet. If the client doesn't call execute(), the transfer will not move forward. If execute() is undefined, the transfer is not ready to be moved forward, eg. because it's loading, it errored, or the transaction was already signed by the user.
  executeCalledAtLeastOnce: boolean; // true iff execute() was called at least once by the client for the current activeTokenTransfer.
  suggestAutoExecute?: true; // true iff ExecuteTokenTransfer recommends that the client automatically invoke execute instead of eg. waiting for the user to click a button.
  isLoading: boolean;
  loadingStatus?: 'Init' | 'SwitchingNetwork' | 'SigningTransaction' | 'ConfirmingTransaction';
  needToSwitchNetworkManually: boolean; // true iff a wallet active network switch is required to execute the to token transfer, but ExecuteTokenTransfer was unable to facilitate an automatic network switch, and the network must be switched by the client (such as by asking the user to switch it manually).
  userSignedTransaction: boolean; // userSignedTransaction is true iff the user has signed the transaction. Note that userSignedTransaction is set to true immediately after successful signing before the transaction is confirmed, and is never cleared back to false unless the client calls reset()
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
  needToSwitchNetworkManually: false;
  userSignedTransaction: boolean;
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
  needToSwitchNetworkManually: false;
  userSignedTransaction: false;
  isSuccess: false;
  successData?: never;
} | {
  status: 'Loading';
  isError: false;
  error?: never;
  warning?: never;
  isReadyToExecute: false;
  execute?: never;
  executeCalledAtLeastOnce: boolean;
  suggestAutoExecute?: never;
  isLoading: true;
  loadingStatus: string; // see enum of loading statuses in base type
  needToSwitchNetworkManually: false;
  userSignedTransaction: boolean;
  isSuccess: false;
  successData?: never;
} | {
  status: 'NeedToSwitchNetworkManually';
  isError: false;
  error?: never;
  warning?: never;
  isReadyToExecute: false;
  execute?: never;
  executeCalledAtLeastOnce: false;
  suggestAutoExecute?: never;
  isLoading: false;
  loadingStatus?: never;
  needToSwitchNetworkManually: true;
  userSignedTransaction: false;
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
  needToSwitchNetworkManually: false;
  userSignedTransaction: true;
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
      needToSwitchNetworkManually: false,
      userIsSigningTransaction: false,
      userSignedTransaction: s.userSignedTransaction,
      isSuccess: false,
    };
    case 'ReadyToExecute': return {
      activeTokenTransfer: s.activeTokenTransfer,
      reset: s.reset,
      status: 'InProgress',
      isError: false,
      inProgress: true,
      buttonClickedAtLeastOnce: s.executeCalledAtLeastOnce,
      needToSwitchNetworkManually: false,
      userIsSigningTransaction: false,
      userSignedTransaction: false,
      isSuccess: false,
    };
    case 'Loading': return {
      activeTokenTransfer: s.activeTokenTransfer,
      reset: s.reset,
      status: 'InProgress',
      isError: false,
      inProgress: true,
      buttonClickedAtLeastOnce: s.executeCalledAtLeastOnce,
      needToSwitchNetworkManually: false,
      userIsSigningTransaction: s.loadingStatus === 'SigningTransaction',
      userSignedTransaction: s.userSignedTransaction,
      isSuccess: false,
    };
    case 'NeedToSwitchNetworkManually': return {
      activeTokenTransfer: s.activeTokenTransfer,
      reset: s.reset,
      status: 'NeedToSwitchNetworkManually',
      isError: false,
      inProgress: false,
      buttonClickedAtLeastOnce: s.executeCalledAtLeastOnce,
      needToSwitchNetworkManually: true,
      userIsSigningTransaction: false,
      userSignedTransaction: false,
      isSuccess: false,
    };
    case 'Success': return {
      activeTokenTransfer: s.activeTokenTransfer,
      reset: s.reset,
      status: 'Success',
      isError: false,
      inProgress: false,
      buttonClickedAtLeastOnce: s.executeCalledAtLeastOnce,
      needToSwitchNetworkManually: false,
      userIsSigningTransaction: false,
      userSignedTransaction: true,
      isSuccess: true,
      successData: s.successData,
    };
  }
}

export type ExecuteTokenTransferProps = {
  tt: TokenTransfer; // the token transfer this will execute. WARNING ExecuteTokenTransfer doesn't support arbitrary ongoing changes to the props TokenTransfer. See ExecuteTokenTransferStatus.activeTokenTransfer.
  confirmationsBeforeSuccess?: number; // number of block confirmations to wait for before reporting a successful transfer. Defaults to 1
  setStatus: (status: ExecuteTokenTransferStatus) => void; // callback for the client to receive updated transfer status. This callback is mandatory because the client must call status.execute() to move the transfer forward. React note: if an ancestor component of ExecuteTokenTransfer caches this updated status as state, then ExecuteTokenTransfer will rerender redundantly each time it updates the status (because an ancestor's subtree rerenders on state change). These redundant rerenders can be avoided by storing eg. an Observer in the ancestor and using the updated status in a cousin component (including potentially caching it as state).
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
  const { chain: activeChain } = useNetwork();
  const { isConnected } = useAccount();
  const [doReset, setDoReset] = useState(false); // doReset is set to true to immediately trigger an internal reset. doReset exists so that reset()'s useCallback doesn't depend on props.tt, so that a client that changes props.tt isn't triggering unnecessary rerenders and status updates, which can cause infinite render loops if an ancestor updates its state on status update.
  const [cachedTT, setCachedTT] = useState<ExecuteTokenTransferProps['tt']>(props.tt); // wagmi's prepare/write/wait hooks aren't particularly resilient to automatic changes in the transfer details. Instead, we cache props.tt to lock in the transfer instance. Clients that wish to change the value of tt can call status.reset() to force a recache to the latest value of props.tt.

  const [isSuccess, setIsSuccess] = useState(false); // wait.isSuccess can sometimes reset itself back to idle (such as on a network switch), so to prevent a Success status from clearing itself, we cache success status as state so that after the user has successfully paid, the transfer never clears its success status unless reset.
  const [userSignedTransaction, setUserSignedTransaction] = useState(false); // userSignedTransaction is set to true iff the user has signed the transaction. Note that userSignedTransaction is set to true immediately after successful signing, before the transaction is confirmed, and is never cleared back to false unless the client calls reset(). The sole purpose of userSignedTransaction is to be surfaced to the client to eg. help the client decide whether or not they want to call reset(). NB write.isSuccess can sometimes reset itself back to idle (such as on a network switch), so to prevent loss of information, we cache userSignedTransaction as state.
  const [autoExecuteState, setAutoExecuteState] = useState<'none' | 'clickedExecuteAndStartedSwitchingNetwork' | 'finishedSwitchingNetworkAndShouldAutoExecute' | 'autoRetry'>("none"); // autoExecuteState is a small state machine used to control whether or not execution of prompting the user to sign the transaction will happen automatically. We want to auto-execute if the user already called status.execute() once (eg. user clicked button once) AND this click caused a network switch to be triggered AND that network switch was successful. This avoids requiring the user to click the button more than once when a network add and/or switch is required. We also want to auto-execute if the transfer has determined it should be automatically retried.
  const [transactionReceipt, setTransactionReceipt] = useState<TransactionReceipt | undefined>(undefined); // `wait` can sometimes can reset itself (such as on network switch), so we cache `wait.data: TransactionReceipt` into transactionReceipt so that after the user has successfully paid, the transfer always has a copy of its receipt.
  const [retries, setRetries] = useState(0); // number of retries, where a retry is attempted when an error occurs that isRetryableError (and would otherwise be a fatal error if it weren't retrayble). This retry count is used to prevent an infinite number of retries. WARNING `retries` is the only state that isn't automatically cleared across resets as it tracks the number of resets in service of automatic retries. Instead, `retries` is cleared only if the client calls status.reset(), so that the retry count is properly reset if the tokenTransfer changes.
  const [willAutoRetry, setWillAutoRetry] = useState(false); // true iff the transfer should update its autoExecuteState to automatically retry on a reset, instead of normally setting autoExecuteState="none"
  const isMaxRetriesExceeded: boolean = retries > 1;

  // Information on wagmi's transaction hooks:
  //
  // What happens when the user's wallet active chain changes while transaction is being confirmed? --> wagmi internals may throw an error, "underlying chain changed", but none of prepare, write, or wait hooks will error. The wait hook will continue monitoring for confirmation and then succeed normally, and we'll compute the Success status.
  // 
  // We did a study on wagmi's write and wait state variables before, during, and after the tx signing pop-up:
  //  write
  //    before sign: idle
  //    during sign pop-up: loading
  //    sign pop-up cancelled: still loading
  //    sign pop-up redriven: still loading
  //    signed and unconfirmed: success
  //    confirmed: idle
  //  wait
  //    before sign: idle
  //    during sign pop-up: idle
  //    sign pop-up cancelled: idle
  //    sign pop-up redriven: idle
  //    signed and unconfirmed: loading
  //    confirmed: success
  //    revert: ? presumably error

  const onTransactionSigned = useCallback<() => void>(() => {
    setUserSignedTransaction(true);
  }, [setUserSignedTransaction]);

  // ********** BEGIN hooks used only for token transfers (and not native currency transfers) **********
  const prepareContractWriteParams = useMemo(() => { // here we must memoize prepareContractWriteParams so that a new object isn't created each render which would cause usePrepareContractWrite to return a new value each render and trigger unnecessary status updates, which can then cause infinite render loops if an ancestor component rerenders each status update.
    if (isTokenAndNotNativeCurrencyTransfer(cachedTT)) return {
      chainId: cachedTT.token.chainId,
      address: cachedTT.token.contractAddress,
      abi: abis.erc20,
      functionName: 'transfer',
      args: [cachedTT.receiverAddress, BigNumber.from(cachedTT.amountAsBigNumberHexString).toString()],
    }; else return {
      enabled: false,
    };
  }, [cachedTT]);
  const prepareContractWrite = usePrepareContractWrite(prepareContractWriteParams);

  const contractWriteParams = useMemo(() => { // here we must memoize contractWriteParams so that a new object isn't created each render which would cause useContractWrite to return a new value each render and trigger unnecessary status updates, which can then cause infinite render loops if an ancestor component rerenders each status update.
    return {
      ...prepareContractWrite.config,
      onSuccess: onTransactionSigned,
    };
  }, [prepareContractWrite.config, onTransactionSigned]);
  const contractWrite = useContractWrite(contractWriteParams);
  // ********** END hooks used only for token transfers (and not native currency transfers) **********

  // ********** BEGIN hooks used only for native currency transfers (and not token transfers) **********

  const prepareSendTransactionParams = useMemo(() => { // here we must memoize prepareSendTransactionParams so that a new object isn't created each render which would cause usePrepareSendTransaction to return a new value each render and trigger unnecessary status updates, which can then cause infinite render loops if an ancestor component rerenders each status update.
    if (isTokenAndNotNativeCurrencyTransfer(cachedTT)) return {
      enabled: false,
    }; else return {
      chainId: cachedTT.token.chainId,
      request: {
        to: cachedTT.receiverAddress,
        value: BigNumber.from(cachedTT.amountAsBigNumberHexString).toString(),
      },
    };
  }, [cachedTT]);
  const prepareSendTransaction = usePrepareSendTransaction(prepareSendTransactionParams);

  const sendTransactionParams = useMemo(() => { // here we must memoize sendTransactionParams so that a new object isn't created each render which would cause useSendTransaction to return a new value each render and trigger unnecessary status updates, which can then cause infinite render loops if an ancestor component rerenders each status update.
    return {
      ...prepareSendTransaction.config,
      onSuccess: onTransactionSigned,
    };
  }, [prepareSendTransaction.config, onTransactionSigned]);
  const sendTransaction = useSendTransaction(sendTransactionParams);

  // ********** END hooks used only for native currency transfers (and not token transfers) **********

  // ********** BEGIN variables that unify token and native currency hook states and provide an abstraction boundary for downstream to not know or care if cachedTT is a token or native currency transfer **********

  const prepare: Pick<typeof prepareContractWrite & typeof prepareSendTransaction, 'isIdle' | 'error' | 'isError' | 'isLoading' | 'isSuccess' | 'isFetched' | 'isFetchedAfterMount' | 'isFetching' | 'isRefetching' | 'status'> & {
    refetch: () => void; // prepareContractWrite.refetch and prepareSendTransaction.refetch have different type signatures and so can't be included in the Pick, but these signatures share a supertype of `() => void` so we can include that supertype manually (and that works because we don't use any of the params passable to refetch).
  } = isTokenAndNotNativeCurrencyTransfer(cachedTT) ? prepareContractWrite : prepareSendTransaction;

  const write: Pick<typeof contractWrite & typeof sendTransaction, 'isIdle' | 'error' | 'isError' | 'isLoading' | 'isSuccess' | 'data' | 'status'> = isTokenAndNotNativeCurrencyTransfer(cachedTT) ? contractWrite : sendTransaction;

  const signAndSendTransaction: (() => void) | undefined = isTokenAndNotNativeCurrencyTransfer(cachedTT) ? contractWrite.write : sendTransaction.sendTransaction; // write.write and sendTransaction.sendTransaction have different names (ie. write vs sendTransaction) so we unify them as a new local variable (ie. signAndSendTransaction) instead of including them in the `write` unification above.

  const writeReset: () => void = useCallback(() => { // WARNING here we define writeReset to reset both the underlying wagmi hooks to ensure that both actually get reset when a reset is executed. If we instead added 'reset' to our `write` unification above and then used `write.reset`, this would be incorrect because when the client calls reset(), the active token transfer (cachedTT) is updated and this may cause the write unification to flip between token/native currency, and then the underlying write hook that needed to be reset (the one that was actually used prior to the reset) wouldn't be reset (because it's reset function would no longer be included in the write unification). So instead, we correctly reset both hooks here and exclude 'reset' from our write unification above.
    contractWrite.reset();
    sendTransaction.reset();
  }, [contractWrite, sendTransaction]);

  // WARNING prepareContractWrite and contractWrite have been unified into `write` and, per the following eslint rules, neither should be used below here so as to create an abstraction boundary where the code below here doesn't have to know or care if we're sending a token or native currency transfer.
  // @eslint-no-use-below[prepareContractWrite]
  // @eslint-no-use-below[contractWrite]

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
    const args = {
      chainId: cachedTT.token.chainId,
      confirmations: props.confirmationsBeforeSuccess === undefined ? 1 : props.confirmationsBeforeSuccess,
      onSuccess: (data: TransactionReceipt) => {
        setTransactionReceipt(data);
        setIsSuccess(true);
      },
    };
    if (write.data?.hash) return Object.assign({ // here we return an args object with hash defined, or an object omitting the 'hash' key (as opposed to setting the hash key to undefined), because useWaitForTransaction doesn't support passing undefined for hash
      hash: write.data.hash,
    }, args);
    else return args;
  }, [props.confirmationsBeforeSuccess, cachedTT.token.chainId, write.data]);
  const wait = useWaitForTransaction(waitParams);

  const transactionFeeUnaffordableError: TransactionFeeUnaffordableError | undefined = useMemo(() => {
    if (transactionFeeUnaffordableErrorFromPrepare && transactionFeeUnaffordableErrorFromWrite) console.error("Unexpected error state: both transactionFeeUnaffordableErrorFromPrepare and transactionFeeUnaffordableErrorFromWrite are defined, but we expected at most one to be defined");
    return transactionFeeUnaffordableErrorFromPrepare || transactionFeeUnaffordableErrorFromWrite;
  }, [transactionFeeUnaffordableErrorFromPrepare, transactionFeeUnaffordableErrorFromWrite]);

  const switchNetworkOnSuccess = useCallback<() => void>(() => {
    setAutoExecuteState("finishedSwitchingNetworkAndShouldAutoExecute");

  }, [setAutoExecuteState]);

  const switchNetworkOnError = useCallback<() => void>(() => {
    // The user rejected the network switch or another error occurred. We'll set autoExecuteState to none, and if the user retries execution and accepts the network switch, that retry will set autoExecuteState back to clickedExecuteAndStartedSwitchingNetwork, and then we'll then auto-execute the transaction signing. Note that we must set autoExecuteState to "none" here otherwise (having rejected/failed this network switch) if the user switches networks manually in their wallet, the transaction will auto-execute despite the user having not clicked the button to switch networks, which is a jarring experience - the transaction confirmation pops up out of nowhere.
    setAutoExecuteState("none");
  }, [setAutoExecuteState]);

  const switchNetworkArgs = useMemo(() => {
    return {
      chainId: cachedTT.token.chainId,
      onSuccess: switchNetworkOnSuccess,
      onError: switchNetworkOnError,
    };
  }, [cachedTT.token.chainId, switchNetworkOnSuccess, switchNetworkOnError]);

  const switchNetwork = useSwitchNetwork(switchNetworkArgs);

  const shouldAutoRetry: boolean = (() => {
    const isErrorRetryable: boolean = isRetryableError(prepare.error) || isRetryableError(write.error) || isRetryableError(wait.error) || isRetryableError(switchNetwork.error); // an error is said to be "retryable" (instead of fatal) if we want to automatically reset the button and automatically retry again
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

  const swr = switchNetwork.reset; // use a local variable so that the reset useEffect's dependency is only on the switchNetwork.reset function and not the entire switchNetwork object
  useEffect(() => {
    if (doReset) {
      // WARNING here we must update all state to initial values; if state is added/changed, we must also reset it here.
      // WARNING however, here we do not clear retries (ie. we dont call setRetries) as retries is persisted across resets.
      setCachedTT(props.tt);
      setIsSuccess(false);
      setUserSignedTransaction(false);
      setAutoExecuteState(willAutoRetry && executeCalledAtLeastOnce && !isSuccess ? "autoRetry" : "none"); // here, we will auto-execute due to autoRetry iff we've just reset due to an auto retry and also the user clicked the button at least once since the previous retry and also we check !isSuccess as an extra sanity to help ensure we don't auto-execute a double-spend. WARNING the latter clause of not auto-executing unless the user clicked the button at least once is crucial because there certain usePrepareContractWrite(...).errors are retryable, and so if we were to auto-execute without the condition of user having clicked button, we would be sending a transaction the user didn't actually request (eg. button loads -> prepare emits retryable error -> reset -> autoRetry -> auto-execute -> now we've executed without the user ever having clicked the button, which is particularly bad for wallets like web3auth that auto-approve any suggestion transactions, so we'd be sending money without the user ever having approved it!)
      setWillAutoRetry(false);
      setTransactionReceipt(undefined);
      writeReset();
      swr();
      setExecuteCalledAtLeastOnce(false);
      setDoReset(false);
    }
  }, [props.tt, setCachedTT, setIsSuccess, isSuccess, setUserSignedTransaction, setAutoExecuteState, setTransactionReceipt, writeReset, swr, setExecuteCalledAtLeastOnce, executeCalledAtLeastOnce, setDoReset, doReset, willAutoRetry, setWillAutoRetry]);
  // @eslint-no-use-below[swr] swr is a local variable intended only to help optimize the above hook

  const needToSwitchNetwork: boolean =
    isChainMismatchError(prepare.error) // ie. wagmi's API is that prepare.error is a chain mismatch error if and only if the wallet's active network differs from the chainId passed to prepare.
    || (activeChain?.id !== undefined && activeChain.id !== cachedTT.token.chainId) // in certain cases, the active chain may not be the token's chain while wagmi's prepare.error is null. For example, this can happen if props.tt.token.chainId is recached after a successful prepare without reseting write. NB wagmi's hooks aren't particularly resilient to changes in props.tt, so we currently don't support automatic changes to props.tt (by way of caching its first value into cachedTT), so rn, we don't expect this conditional branch to ever be true because prepare.error should be ChainMismatchError unless activeChain==token.chainId, but we kept the conditional branch code anyway because it's knowlege and probably more correct.

  const sw = switchNetwork.switchNetwork; // allow useMemo hook dep to be on switchNetwork.switchNetwork instead of switchNetwork
  const writeIsLoading = write.isLoading; // allow useMemo hook dep to be on write.isLoading instead of write;
  const execute: () => void = useCallback(() => { // status will be ReadyToExecute only if the user may prompt a programmatic network switch or sign the transaction. So, here we construct an execute function to run these actions. NB it may be invalid to run this execute because we would be in any status (such as Error), but we construct execute here because hooks must be run unconditionally. WARNING we construct execute with useCallback so that if execute's dependencies change, we'll trigger a rerender and pass the updated execute to the client. If instead we defined execute inline (without useCallback/useMemo), then execute's dependencies could change but the client would still have a stale version of execute if a re-render hadn't been triggered to push the new status and new execute to the client
    setExecuteCalledAtLeastOnce(true);
    if (!isConnected) {
      console.error("ExecuteTokenTransfer: execute() called when wallet not connected");
    } if (needToSwitchNetwork && sw) {
      setAutoExecuteState("clickedExecuteAndStartedSwitchingNetwork");
      sw();
    } else if (signAndSendTransaction && !writeIsLoading) { // here we protect against redundant calls to write.write by ensuring that we call write.write only if write isn't loading. This helps to make execute idempotent so that if client calls it repeatedly for any reason, we don't end up throws errors or in an error state. (NB we might be tempted to check write.isIdle here instead of write.isLoading, but that's incorrect because if the user already rejected the transaction, write.isIdle is false and write.error is an instanceof UserRejectedRequestError.)
      setAutoExecuteState("none");
      signAndSendTransaction();
    } else throw new Error(`ExecuteTokenTransfer: unexpected execute()`);
  }, [isConnected, setAutoExecuteState, needToSwitchNetwork, sw, signAndSendTransaction, writeIsLoading]);
  // @eslint-no-use-below[sw] sw is a local variable intended only to help optimize the above hook

  // console.log("ExecuteTokenTransfer\ntt", cachedTT, "\nprepare", {
  //   status: prepare.status,
  //   error: prepare.error,
  //   isError: prepare.isError,
  //   isLoading: prepare.isLoading,
  //   isFetching: prepare.isFetching,
  //   isRefetching: prepare.isRefetching,
  //   isFetched: prepare.isFetched,
  //   isFetchedAfterMount: prepare.isFetchedAfterMount,
  //   isSuccess: prepare.isSuccess,
  //   isIdle: prepare.isIdle,
  // }, "\nwrite", {
  //   status: write.status,
  //   error: JSON.stringify(write.error),
  //   isLoading: write.isLoading,
  //   signAndSendTransaction,
  //   data: write.data,
  // }, "\nwait", {
  //   status: wait.status,
  //   error: wait.error,
  //   isLoading: wait.isLoading,
  //   isFetching: wait.isFetching,
  //   isRefetching: wait.isRefetching,
  //   isFetched: wait.isFetched,
  //   isFetchedAfterMount: wait.isFetchedAfterMount,
  // }, "\nswitchNetwork", {
  //   status: switchNetwork.status,
  //   switchNetwork: switchNetwork.switchNetwork,
  //   error: switchNetwork.error,
  // }, "\nretries:", retries, "willAutoRetry", willAutoRetry, "shouldAutoRetry", shouldAutoRetry);

  const isEverythingIdle: boolean = prepare.isIdle && write.isIdle && wait.isIdle && (switchNetwork.isIdle || switchNetwork.switchNetwork === undefined); // NB wagmi seems to return all hooks idle and not loading on first render/component mount. Ie. prepare.isLoading is false on the initial render (and write.isLoading and wait.isLoading are also false), so we'll use this flag to detect if everything is idle, and if so, we'll assign the Loading Init status.

  useEffect(() => {
    const nextStatus: ExecuteTokenTransferStatus = (() => {
      if (transactionReceipt && isSuccess) { // NB here we compute Success status regardless of whether or not the wallet is connected. This is because wagmi's wait hook is able to monitor for confirmation even if the user's wallet disconnects or the wallet's active chain changes. So by computing Succcess status regardles of wallet connection/active chain, we're being more useful to the client. Also see design note on isSuccess definition.
        const s: ExecuteTokenTransferStatus = {
          activeTokenTransfer: cachedTT,
          reset,
          status: 'Success',
          isError: false,
          isReadyToExecute: false,
          executeCalledAtLeastOnce: true,
          isLoading: false,
          needToSwitchNetworkManually: false,
          userSignedTransaction: true,
          isSuccess: true,
          successData: transactionReceipt,
        };
        return s;
      } else if (!transactionReceipt && isSuccess) {
        // here we've entered into an inconsistent state where the transfer was successful but the transaction receipt is unavailable
        const s: ExecuteTokenTransferStatus = {
          activeTokenTransfer: cachedTT,
          reset,
          status: 'Error',
          isError: true,
          error: Error(`Receipt Missing`),
          isReadyToExecute: false,
          executeCalledAtLeastOnce,
          isLoading: false,
          needToSwitchNetworkManually: false,
          userSignedTransaction,
          isSuccess: false,
        };
        return s;
      } else if (!autoRetryInProgress && (
        (prepare.error
          && !isChainMismatchError(prepare.error)
          && !isEphemeralPrepareError(prepare.error)
        ) || (write.error && !userRejectedTransactionSignRequest)
        || wait.error
      )) {
        const errorToIncludeInStatus: Error = (() => {
          if (transactionFeeUnaffordableError) return transactionFeeUnaffordableError; // WARNING here we must prioritize transactionFeeUnaffordableError which is derived from prepare or write errors. If we prioritized write/prepare errors, then we would be losing from the status the information that the user can't afford the transaction fee.
          else if (wait.error) return wait.error; // similarly, here we prioritize a wait error over write/prepare errors, so that if the user has signed a transaction, we are reporting any error on that confirmation and don't lose information eg. to a new prepare error due to a new network switch.
          else if (write.error) return write.error; // similarly, here we prioritize a write error over a prepare error, so that if the user signed a transaction, we report any error on that signature and not don't lose information eg. to a new prepare error due to a new network switch.
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
          needToSwitchNetworkManually: false,
          userSignedTransaction,
          isSuccess: false,
        };
        return s;
      } else if (
        !isConnected // below we'll compute a status of Loading - Init when the wallet isn't connected as a way to gracefully degrade since we can't transfer a token without a connected wallet
        || prepare.isLoading
        || write.isLoading
        || wait.isLoading
        || switchNetwork.isLoading
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
          else if (switchNetwork.isLoading) return 'SwitchingNetwork';
          else if (write.isLoading) return 'SigningTransaction';
          else if (wait.isLoading) return 'ConfirmingTransaction';
          else throw new Error(`ExecuteTokenTransfer: unexpected loading status`);
        })();
        const s: ExecuteTokenTransferStatus = {
          activeTokenTransfer: cachedTT,
          reset,
          status: 'Loading',
          isError: false,
          isReadyToExecute: false,
          executeCalledAtLeastOnce,
          isLoading: true,
          loadingStatus,
          needToSwitchNetworkManually: false,
          userSignedTransaction,
          isSuccess: false,
        };
        return s;
      } else if (needToSwitchNetwork && (
        switchNetwork.switchNetwork === undefined // need to switch network manually if wagmi was unable to construct a switchNetwork instance
        || (
          // also need to switch network manually if there was a fatal switch network error. rn, nonfatal network switch errors come in two flavors: 1) the user rejecting the network switch or 2) our manual detection of nonfatal errors in isNetworkSwitchNonFatalError
          switchNetwork.error
          && !(switchNetwork.error instanceof UserRejectedRequestError)
          && !isNetworkSwitchNonFatalError(switchNetwork.error)
        )
      )) {
        const s: ExecuteTokenTransferStatus = {
          activeTokenTransfer: cachedTT,
          reset,
          status: 'NeedToSwitchNetworkManually',
          isError: false,
          isReadyToExecute: false,
          executeCalledAtLeastOnce: false,
          isLoading: false,
          needToSwitchNetworkManually: true,
          userSignedTransaction: false,
          isSuccess: false,
        };
        return s;
      } else if (
        (needToSwitchNetwork && switchNetwork.switchNetwork !== undefined)
        || signAndSendTransaction !== undefined
      ) {
        const s: Writable<ExecuteTokenTransferStatus> = {
          activeTokenTransfer: cachedTT,
          reset,
          status: 'ReadyToExecute',
          isError: false,
          isReadyToExecute: true,
          execute,
          executeCalledAtLeastOnce,
          isLoading: false,
          needToSwitchNetworkManually: false,
          userSignedTransaction: false,
          isSuccess: false,
        };
        if (userRejectedTransactionSignRequest) {
          s.warning = 'UserRejectedTransaction';
        } else if (isUserRejectedNetworkAddError(switchNetwork.error)) {
          s.warning = 'UserRejectedNetworkAdd';
        } else if (
          (switchNetwork.error && switchNetwork.error instanceof UserRejectedRequestError)
        ) {
          s.warning = 'UserRejectedNetworkSwitch';
        } else if (isNetworkSwitchNonFatalError(switchNetwork.error)) {
          s.warning = 'NetworkSwitchNonFatalError';
        }
        if (
          autoExecuteState === "finishedSwitchingNetworkAndShouldAutoExecute"
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
          needToSwitchNetworkManually: false,
          userSignedTransaction,
          isSuccess: false,
        };
        return s;
      }
    })();
    setStatus(nextStatus); // design note: in general, nextStatus may be identical to the current status cached by clients. This is because there's a loss of information between this useEffect's dependencies when computing nextStatus. For example, if switchNetwork becomes defined, we will compute nextStatus, but both the current and next status may have nothing to do with switchNetwork being defined or not. In fact, this is exactly what usually happens when this component initializes: switchNetwork.switchNetwork is initially undefined, and it becomes defined shortly after mounting, which triggers computation of nextStatus, but both the current status and nextStatus are "Loading - Init", so we know we're usually sending a redundant nextStatus to the client. If we wanted to fix this, a good way to do so may be to do a deep comparison of ObservableValue.getCurrentValue vs. nextStatus in ExecuteTokenTransferButton, and skip calling setValueAndNotifyObservers if the current and next statuses are equal. A good deep comparison library is fast-deep-equal, it is both fast and relatively small (13kb), but that's still an extra 13kb of bundle size. But currently, we think it's better to shave 13kb off the bundle size vs. avoiding a few unnecessary rerenders that React handles instantly and without any UI jank/disruptions because the shadow DOM diff interprets the redundant status update as a no-op, so that's why right now, nextStatus may be identical to the current status cached by clients.
  }, [setStatus, isConnected, cachedTT, prepare.error, write.error, wait.error, switchNetwork.error, prepare.isLoading, write.isLoading, wait.isLoading, switchNetwork.isLoading, isEverythingIdle, needToSwitchNetwork, switchNetwork.switchNetwork, execute, reset, transactionReceipt, isSuccess, userSignedTransaction, signAndSendTransaction, autoExecuteState, userRejectedTransactionSignRequest, transactionFeeUnaffordableError, executeCalledAtLeastOnce, autoRetryInProgress]);

  return null;
}

// isUserRejectedNetworkAddError returns true iff the passed Error
// represents the user having rejected a request to add a network. The
// error passed must be sourced from `useSwitchNetwork(...).error` or
// behaviour is undefined.
function isUserRejectedNetworkAddError(e: Error | undefined | null): boolean {
  // WARNING due to a bug in wagmi, rejecting a network switch after accepting a network add results in the error appearing as if the network add was rejected. So rn, we categorize "accept add -> reject switch" as "reject add". This bug should automatically fix itself in our codebase after the wagmi bug is fixed. https://github.com/wagmi-dev/wagmi/issues/2132

  // WARNING errors passed into this function can come from a variety of upstream sources, and they may not confirm to the TypeScript typeof Error, which is why we do extra checking to ensure properties exist before we read them.
  if (e === undefined || e === null) return false;
  else {
    const userRejectionCause: object | undefined = e instanceof UserRejectedRequestError && typeof e.cause === 'object' && e.cause !== null ? e.cause : undefined;
    const userRejectionCauseMessage: string | undefined = hasOwnPropertyOfType(userRejectionCause, 'message', 'string') ? userRejectionCause.message : undefined;
    if (
      (userRejectionCauseMessage && userRejectionCauseMessage.includes('Unrecognized chain')) // MetaMask browser extension. Explanation: when the user rejects auto-add of a network, wagmi returns the same error (switchNetwork.error: UserRejectedRequestError) as when the user rejects auto-switch of a network. But, we can distinguish between rejection of a network add vs. switch by looking for the "Unrecognized chain" in the Error cause which is sourced from MetaMask browser extension. For reference, here's the full message on reject add as returned by the metamask browser extension: `Unrecognized chain ID "0x66eed". Try adding the chain using wallet_addEthereumChain first.`
      // TODO support more wallets
    ) return true;
    else return false;
  }
}

// isUserRejectedTransactionSignRequestError returns true iff the passed
// Error represents the user having rejected a request to sign a
// transaction. The error passed must be sourced from
// `useContractWrite(...).error` or behaviour is undefined.
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

// isNetworkSwitchNonFatalError returns true iff the passed Error
// represents a non-fatal error when attempting to switch the network. The
// error passed must be sourced from `switchNetwork(...).error` or
// behaviour is undefined.
function isNetworkSwitchNonFatalError(e: Error | undefined | null): boolean {
  // WARNING errors passed into this function can come from a variety of upstream sources, and they may not confirm to the TypeScript typeof Error, which is why we do extra checking to ensure properties exist before we read them.
  if (e === undefined || e === null) return false;
  else {
    const switchChainErrorCause: object | undefined = e instanceof SwitchChainError && typeof e.cause === 'object' && e.cause !== null && e.cause !== undefined ? e.cause : undefined; // for some popular wallets (such as metamask browser extension), wagmi supports mapping the underlying wallet error into a typed error. Currently, all non-fatal errors we detect are SwitchChainError
    const switchChainErrorCauseMessage: string | undefined = hasOwnPropertyOfType(switchChainErrorCause, 'message', 'string') ? switchChainErrorCause.message : undefined;
    if (
      (switchChainErrorCauseMessage && switchChainErrorCauseMessage.includes('already pending')) // metamask returns this if another network switch modal is already pending when the network switch is attempted
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
    const errString: string = `${JSON.stringify(e)} ${hasOwnPropertyOfType(e, 'message', 'string') ? e.message : ''}`; // search the error as a string instead of digging into structured properties because the errString method is simpler and perhaps more robust in that if the error's data structure changes but the message doesn't change, searching the errString still works but structured properties would fail. WARNING JSON.stringify doesn't always include all error properties, so we include certain properties manually.
    if (errString.includes('max fee per gas less than block base fee')) return true; // web3auth+arbitrum and metamask+all chains return this error if the signed transaction's maxFeePerGas is less than the current block's base fee. This can occur if the chain's base fee has risen rapidly since the transaction was signed and the maxFeePerGas (automatically set internally in wagmi+wallet) becomes less than the new base fee. For example, arbitrum's fast block times can enable the base fee to sometimes rise very rapidly.
    else if (errString.includes('fee cap less than block base fee')) return true; // web3auth+goerli returns this error if the signed transaction's maxFeePerGas is less than the current block's base fee. This can occur if the chain's base fee has risen rapidly since the transaction was signed and the maxFeePerGas (automatically set internally in wagmi+wallet) becomes less than the new base fee.
    else if (errString.includes('intrinsic gas too low')) return true; // metamask+arbitrum can return this error if the signed transaction's maxFeePerGas (??) is less than the current block's base fee. This can occur if the chain's base fee has risen rapidly since the transaction was signed and the maxFeePerGas (automatically set internally in wagmi+wallet) becomes less than the new base fee.
    else return false;
  }
}

// isEphemeralPrepareError returns true iff the passed Error indicates
// useContractPrepareWrite or usePrepareSendTransaction failed for
// ephemeral reasons and can be immediately retried by way of being
// refetch()'d. Ephemeral errors are typically entirely local and don't
// involve network operations as they are retried an infinite number of
// times with no backoff. An example kind of ephemeral error would be a
// race condition in a module dependency. Not to be confused with
// isRetryableError. The error passed must be sourced from
// `usePrepareContractWrite(...).error` or
// `usePrepareSendTransaction(...).error` or behaviour is undefined.
function isEphemeralPrepareError(e: Error | undefined | null): boolean {
  // WARNING errors passed into this function can come from a variety of upstream sources, and they may not confirm to the TypeScript typeof Error, which is why we do extra checking to ensure properties exist before we read them.
  if (e === undefined || e === null) return false;
  else {
    const errString: string = `${JSON.stringify(e)} ${hasOwnPropertyOfType(e, 'message', 'string') ? e.message : ''}`;  // search the error as a string instead of digging into structured properties because the errString method is simpler and perhaps more robust in that if the error's data structure changes but the message doesn't change, searching the errString still works but structured properties would fail. WARNING JSON.stringify doesn't always include all error properties, so we include certain properties manually.
    if (errString.includes('Chain') && errString.includes('not configured for connector') && errString.includes('web3auth')) return true; // web3auth returns this when switching chains because there's a race condition inside web3auth where connector.switchChain returns before the chain has actually been successfully switched.
    else return false;
  }
}

// isChainMismatchError returns true iff the passed Error indicates that
// usePrepareContractWrite failed because the connected account's active
// network did not match the transaction's chainId passed to prepare.
// The error passed must be sourced from
// `usePrepareContractWrite(...).error` or behaviour is undefined.
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
// unaffordability is detected during usePrepareContractWrite, and for
// other wallets, fee unaffordability is not detected until
// useContractWrite, and so the error passed may be sourced from
// usePrepareContractWrite or useContractWrite (and possibly for some
// future wallets we haven't yet investigated, possibly as late as
// useWaitForTransaction following a successul write). 
function tryMakeTransactionFeeUnaffordableError(e: Error | undefined | null): TransactionFeeUnaffordableError | undefined {
  // WARNING errors passed into this function can come from a variety of upstream sources, and they may not confirm to the TypeScript typeof Error, which is why we do extra checking to ensure properties exist before we read them.
  if (e === undefined || e === null) return undefined;
  else if (
    (hasOwnPropertyOfType(e, 'stack', 'string') && e.stack.includes("insufficient funds for gas")) // MetaMask browser extension returns this as usePrepareContractWrite(...).error
    || (hasOwnPropertyOfType(e, 'message', 'string') && e.message.includes('Failed to sign transaction')) // Coinbase Wallet on mobile with 3c on desktop (using Coinbase's version of walletconnect) returns this as useContractWrite(...).error. WARNING this error is overly general and may catch other kinds of Coinbase transaction signing errors. For example, currently, signing an affordable transaction on a network that's not directy supported by Coinbase also fails with this error  (eg. Pay 10 USDC on Arbitrum Goerli with sufficient ETH to pay the fee also fails with this error)
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

// ****************************************************************
// BEGIN - list of other wallet-specific or chain-specific errors that we've
// seen but haven't implemented into code:

// gasLimit set below estimated gas
//   web3auth on goerli returns "{\"code\":-32603,\"data\":{\"code\":-32000,\"message\":\"INTERNAL_ERROR: IntrinsicGas\"}}" as useContractWrite(...).error
//   web3auth on arbitrumGoerli returns {"code":-32603,"data":{"code":-32000,"message":"intrinsic gas too low"}} as useContractWrite(...).error

// END - list of other wallet-specific or chain-specific errors that we've
// seen but haven't implemented into code.
// ****************************************************************
