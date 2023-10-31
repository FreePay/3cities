import React from "react";
import { Link } from "react-router-dom";

export const Home: React.FC = () => {
  return <div className="mt-8 text-left max-w-2xl mx-auto">
    <h1 className="text-center text-3xl mb-4">Decentralized Payments for Ethereum</h1>
    <div className="flex flex-col gap-12 justify-center items-center mt-8">
      <Link to="/pay-link">
        <button
          type="button"
          className="mt-4 w-40 focus:outline-none rounded-md p-3.5 font-medium bg-primary sm:hover:bg-primary-darker active:scale-95 text-white"
        >
          Send Pay Link
        </button>
      </Link>
      <a href="https://staging.3cities.xyz/#/pay?c=Egdmb28uZXRoGAEiAgPo&demoAccount=0xac0d7753EA2816501b57fae9ad665739018384b3" target="_blank" rel="noreferrer">
        <button
          type="button"
          className="mt-4 w-40 focus:outline-none rounded-md p-3.5 font-medium bg-primary sm:hover:bg-primary-darker active:scale-95 text-white"
        >
          Demo
        </button>
      </a>
    </div>
  </div>;
};
