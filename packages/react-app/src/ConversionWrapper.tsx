import React from "react";
import { Outlet } from "react-router-dom";
import { ConnectWalletButtonCustom } from "./ConnectWalletButton";

function ConversionHeader() {
  return (
    <header className="bg-quaternary p-5 min-h-[80px] flex items-center">
      <div className="mx-auto flex w-full max-w-screen-lg items-center justify-between">
        <div className="flex flex-1 items-center justify-end gap-8">
          <div>
            <ConnectWalletButtonCustom
              disconnectedLabel=""
              hideIfDisconnected={true}
              className="rounded-md px-3.5 py-2 text-xs font-medium bg-white hover:bg-gray-200 focus:outline-none active:scale-95 w-full sm:w-48 text-quaternary"
              disabledClassName="text-blue-700 pointer-events-none"
              enabledClassName="text-blue-500"
              loadingSpinnerClassName="text-blue-700 fill-white"
            />
          </div>
        </div>
      </div>
    </header>
  );
}

export const ConversionWrapper = () => {
  return (
    <div className="min-h-screen flex flex-col text-neutral-700">
      <ConversionHeader />
      <div className="grow flex flex-col items-center justify-start">
        <div className="w-full max-w-sm overflow-hidden bg-white px-5">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
