import React from "react";
import { Outlet } from "react-router-dom";
import { ConnectWalletButtonCustom } from "./ConnectWalletButton";

function ConversionHeader() {
  return (
    <header className="bg-quaternary p-5 min-h-[80px] flex items-center">
      <div className="mx-auto flex w-full max-w-screen-lg items-center justify-between">
        <div className="flex flex-1 items-center justify-end gap-8">
          <div className="max-sm:min-w-[46vw] max-sm:max-w-48 sm:w-48">
            <ConnectWalletButtonCustom
              disconnectedLabel=""
              hideIfDisconnected={true}
              className="rounded-md px-3.5 py-2 text-xs font-medium bg-white sm:enabled:hover:bg-gray-200 focus:outline-none enabled:active:scale-95 w-full"
              disabledClassName="text-quaternary-darker pointer-events-none"
              enabledClassName="text-quaternary"
              loadingSpinnerClassName="text-quaternary-darker fill-white"
            />
          </div>
        </div>
      </div>
    </header>
  );
}

export const ConversionWrapper = () => {
  return (
    <div className="min-h-screen flex flex-col text-black">
      <ConversionHeader />
      <div className="grow flex flex-col items-center justify-start bg-gray-100">
        <div className="w-full max-w-sm overflow-hidden px-5 pb-5">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
