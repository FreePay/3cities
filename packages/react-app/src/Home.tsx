import React from "react";
import { Link } from "react-router-dom";

export const Home: React.FC = () => {
  return <div className="mt-8 text-left max-w-2xl mx-auto">
    <h1 className="text-center text-3xl mb-4">Decentralized Payments for Ethereum</h1>
    <div className="flex flex-col gap-12 justify-center items-center mt-8">
      <Link to="/pay-link">
        <button
          type="button"
          className="mt-4 w-64 focus:outline-none rounded-md p-3.5 font-medium bg-primary sm:hover:bg-primary-darker active:scale-95 text-white"
        >
          Custom Pay Request Link
        </button>
      </Link>
    </div>
    <div className="flex flex-col gap-4 justify-center items-center mt-24">
      <h2 className="text-center text-3xl">Partners</h2>
      <a href="https://bluechip.org/" target="_blank" rel="noreferrer" className="sm:hover:cursor-pointer max-w-md"><img src="/bluechip-wordmark.png" alt="Bluechip" /></a>
    </div>
  </div>;
};
