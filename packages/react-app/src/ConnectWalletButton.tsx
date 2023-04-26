import { ConnectKitButton } from "connectkit";
import React from "react";
import { Spinner } from "./Spinner";

// TODO after we ship web3auth, when wallet is connected, the button label should show login-method-specific detail: address if you connected wallet, email if email/google, etc.

type CustomConnectWalletButtonProps = {
  disconnectedLabel: string; // label to put on the button when the user's wallet is disconnected, eg. "Connect Wallet".
  hideIfDisconnected?: true; // iff set, hide the button if the user's wallet is disconnected. This can be useful eg. to reduce the call-to-action clutter if there is already another connect wallet button onscreen.
  disabled?: true | string; // force-disable disable the button. Pass true to disable the button. Pass a string to disable the button and display the passed string as the disabled reason. Note, the button may still be disabled for internal reasons even if this is not set.
  className?: string // className to unconditionally apply to the button element.
  disabledClassName?: string // className to apply iff button is disabled.
  enabledClassName?: string // className to apply iff button is enabled.
  loadingSpinnerClassName?: string // className applied to the loading spinner iff button is loading. The text color is used for the loading spinner's foreground color, and the svg fill color is used for the loading spinner's background color. Recommended: set text color to same color as the disabled button label (as button is disabled during loading) and fill color to same color as button's (disabled) background color.
}

// ConnectWalletButtonCustom is our entrypoint for clients that want to
// customize the look & feel of a connect wallet button, but to still have
// the same behavior/UX as other connect wallet buttons in the app. Most
// clients should instead use ConnectWalletButton, which is a styled
// wrapper around this component.
export const ConnectWalletButtonCustom: React.FC<CustomConnectWalletButtonProps> = ({ disconnectedLabel, hideIfDisconnected, disabled, className, disabledClassName, enabledClassName, loadingSpinnerClassName, }) => {
  // WARNING connectkit has two bugs that are preventing our button from properly detecting if isConnecting is actually true.
  // Bug 1. ConnectKitButton.Custom.isConnecting is currently false if the modal is closed but we're actually connecting or reconnecting because it only checks open status https://github.com/family/connectkit/issues/203
  // Bug 2. connectkit currently causes wagmi.useAccount.isConnecting to be set to true forever after the modal has been opened once. This prevents the use of isConnecting to determine if we're actually connecting, so right now, there's no way in general to make our button show 'Connecting <loading spinner>' when we're actually loading. https://github.com/family/connectkit/pull/202#issuecomment-1515458891
  // TODO --> when both these bugs are fixed in connectkit, ConnectKitButton.Custom.isConnecting should just work properly and these comments can be removed.
  // TODO consider using our own address truncation here instead of ConnectKitButton.Custom.{truncatedAddress,ensName}
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, isConnecting, show, truncatedAddress, ensName }) => {
        const isButtonDisabled = (disabled !== undefined) || isConnecting;
        const computedClassName = `relative ${className || ''} ${isButtonDisabled ? (disabledClassName || '') : ''} ${!isButtonDisabled ? (enabledClassName || '') : ''}`;
        const computedLabel = (() => {
          const disabledReason = typeof disabled === 'string' ? disabled : undefined;
          const needToApproveConnectionInWallet = !isConnected && isConnecting ? 'Connecting' : undefined; // TODO we can drop `!isConnected` after the isConnecting bugs above are resolved in connectkit because at that point, we'll want to show 'Connecting' iff isConnecting because isConnecting will actually be defined correctly.
          return <>{disabledReason || needToApproveConnectionInWallet || (isConnected ? (ensName || truncatedAddress || '(no address)') : disconnectedLabel)}</>;
        })();
        const computedSpinner =
          disabled === undefined // don't show loading spinner if button has been forcibly disabled by the client because even if it is loading internally, it won't be clickable until the client changes this
          && isConnecting // show loading spinner if button is connecting, of course
          && <Spinner
            containerClassName="absolute top-1/2 transform -translate-y-1/2 right-2 z-10 h-6 w-6 flex items-center justify-center"
            spinnerClassName={`${loadingSpinnerClassName}`}
          />;
        return (!hideIfDisconnected || isConnected) ? <button
          type="button"
          disabled={isButtonDisabled}
          onClick={show}
          className={computedClassName}
        >
          {computedLabel}
          {computedSpinner}
        </button> : undefined;
      }}
    </ConnectKitButton.Custom>
  );
};

type ConnectWalletButtonProps = Partial<Pick<CustomConnectWalletButtonProps, 'disconnectedLabel' | 'disabled'>>

// ConnectWalletButton is our canonical connect wallet button using our
// primary color. Intended for use on a white background.
export const ConnectWalletButton: React.FC<ConnectWalletButtonProps> = (props) => <ConnectWalletButtonCustom
  disconnectedLabel='Connect Wallet'
  {...props /* NB here we spread props after passing a static disconnectedLabel so that any props.disconnectedLabel takes precedence, so that the static value is an overridable default */}
  className="rounded-md p-3.5 font-medium bg-primary sm:enabled:hover:bg-primary-darker focus:outline-none enabled:active:scale-95 w-full"
  disabledClassName="text-gray-200 pointer-events-none"
  enabledClassName="text-white"
  loadingSpinnerClassName="text-gray-200 fill-primary"
/>
