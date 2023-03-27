import React from "react";
import { Link } from "react-router-dom";
import logo from "./images/logo.jpg";
import { WalletButton } from "./WalletButton";

export function Header() {
  return (
    <header className="bg-white p-5 shadow-md">
      <div className="mx-auto flex w-full max-w-screen-lg items-center justify-between">
        <Link to="/" className="flex items-center">
          <img src={logo} className="mt-1 w-8" alt="3cities" />
          <span className="text-2xl font-extrabold tracking-tight">
            3cities&nbsp;&nbsp;&nbsp;&nbsp;
          </span>
        </Link>
        <div className="flex flex-1 items-center justify-end gap-8">
          <div className="shrink">
            <ConnectKitButton showBalance={false} showAvatar={false} onClick={(open: () => void) => open()} />
          </div>
        </div>
      </div>
    </header>
  );
}
