import { ConnectKitButton } from "connectkit";
import React from "react";
import { Spinner } from "./Spinner";

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
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, isConnecting, show, truncatedAddress, ensName }) => {
        const isButtonDisabled = (disabled !== undefined) || isConnecting;
        const computedClassName = `relative ${className || ''} ${isButtonDisabled ? (disabledClassName || '') : ''} ${!isButtonDisabled ? (enabledClassName || '') : ''}`;
        const computedLabel = (() => {
          const disabledReason = typeof disabled === 'string' ? disabled : undefined;
          const needToApproveConnectionInWallet = !isConnected && isConnecting ? 'Connecting' : undefined; // NB connectkit returns isConnecting==true when the modal is open even if isConnected==true, so here we show 'Connecting' only if we're not already connected
          return <>{disabledReason || needToApproveConnectionInWallet || (isConnected ? (ensName || truncatedAddress || '(no address)') : disconnectedLabel)}</>;
        })();
        const computedSpinner =
          disabled === undefined // don't show loading spinner if button has been forcibly disabled by the client because even if it is loading internally, it won't be clickable until the client changes this
          && isConnecting // show loading spinner if button is connecting, of course
          && <Spinner
            containerClassName="absolute top-1/2 transform -translate-y-1/2 right-4 z-10 h-6 w-6 flex items-center justify-center"
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
  className="rounded-md p-3.5 font-medium bg-primary hover:bg-primary-darker focus:outline-none active:scale-95 w-full"
  disabledClassName="text-gray-200 pointer-events-none"
  enabledClassName="text-white"
  loadingSpinnerClassName="text-gray-200 fill-primary"
/>
