import React from "react";
import { FaHandHoldingUsd, FaHome, FaTwitter, FaUserCircle } from "react-icons/fa";
import { Link, Outlet } from "react-router-dom";
import { ConnectWalletButtonCustom } from "./ConnectWalletButton";
import { Wordmark } from "./Wordmark";

const Header: React.FC = () => {
  return (
    <header className="hidden sm:flex bg-quaternary p-5 min-h-[80px] items-center w-full">
      <div className="flex flex-none items-center justify-start w-48">
        <Link to="/">
          <Wordmark />
        </Link>
      </div>
      <div className="flex flex-1 gap-16 items-center justify-center px-4">
        <Link to="/" className="flex flex-col items-center text-center">
          <FaHome />
          <span className="text-sm">Home</span>
        </Link>
        <Link to="/request-money" className="flex flex-col items-center text-center">
          <FaHandHoldingUsd />
          <span className="text-sm">Request Money</span>
        </Link>
        <Link to="/me" className="flex flex-col items-center text-center w-10">
          <FaUserCircle />
          <span className="text-sm">Me</span>
        </Link>
      </div>
      <div className="flex flex-none items-center justify-end">
        <div className="max-sm:min-w-[46vw] max-sm:max-w-48 sm:w-48">
          <ConnectWalletButtonCustom
            disconnectedLabel="Connect Wallet"
            className="rounded-md px-3.5 py-2 text-xs font-medium bg-white sm:enabled:hover:bg-gray-200 focus:outline-none active:scale-95 w-full"
            disabledClassName="text-quaternary-darker pointer-events-none"
            enabledClassName="text-quaternary"
            loadingSpinnerClassName="text-quaternary-darker fill-white"
          />
        </div>
      </div>
    </header >
  );
}

const Footer: React.FC = () => {
  return (
    <footer className="fixed inset-x-0 bottom-0 sm:static bg-quaternary p-5 min-h-[80px] flex items-center">
      <div className="mx-auto flex w-full sm:w-auto sm:gap-16 items-center justify-between">
        <Link to="/" className="sm:hidden flex flex-col items-center text-center w-10">
          <FaHome />
          <span className="text-sm">Home</span>
        </Link>
        <Link to="/request-money" className="sm:hidden flex flex-col items-center text-center">
          <FaHandHoldingUsd />
          <span className="text-sm">Request Money</span>
        </Link>
        <Link to="/me" className="sm:hidden flex flex-col items-center text-center w-10">
          <FaUserCircle />
          <span className="text-sm">Me</span>
        </Link>
        <Link to="/about" className="hidden sm:flex flex-none w-12 flex-col items-center text-center gap-1 rounded-md px-2.5 py-1.5 transition sm:hover:bg-black sm:hover:bg-opacity-10 justify-center">
          <span className="text-sm">About</span>
        </Link>
        <a href="https://twitter.com/3cities_xyz" target="_blank" rel="noreferrer" className="hidden sm:flex flex-none w-12 items-center gap-1 rounded-md px-2.5 py-1.5 transition sm:hover:bg-black sm:hover:bg-opacity-10 justify-center">
          <FaTwitter />
        </a>
        <Link to="/faq" className="hidden sm:flex flex-none w-12 flex-col items-center text-center gap-1 rounded-md px-2.5 py-1.5 transition sm:hover:bg-black sm:hover:bg-opacity-10 justify-center">
          <span className="text-sm">FAQ</span>
        </Link>
      </div>
    </footer>
  );
}

export const MainWrapper = () => {
  return (
    <div className="min-h-screen flex flex-col text-black">
      {/* <div className="fixed left-1/2 top-0 w-0.5 bg-red-500 h-full">this is a debug horizontally-centered vertical line to help align header/footer</div> */}
      <Header />
      <div className="grow flex flex-col items-center justify-start bg-gray-100 max-sm:pb-[120px]">
        {/* NB the pb-[120px] on this parent div ensures there is sufficient (80px would be the minimum, and we added another 40px) blank space below the outlet that's the same height as the footer, which has the effect of ensuring that the user can scroll down to view the bottom of the content, otherwise the content bottom would be hidden behind the footer. */}
        <div className="w-full overflow-hidden px-5">
          <Outlet />
        </div>
      </div>
      <Footer />
    </div>
  );
};
