import React from "react";
import { Link } from 'react-router-dom';
import { chainsSupportedBy3cities } from "./chains";
import { allLogicalAssetTickers, logicalAssetsByTicker } from "./logicalAssets";
import { allTokenTickers } from "./tokens";

export const About: React.FC = () => {
  return (<div className="mt-8">
    <h1 className="text-center text-3xl mb-4">About 3cities</h1>
    <div className="text-left max-w-2xl mx-auto">
      <p className="text-xl mb-4">
        3cities is a payments app focused on accessibility and credible neutrality.
      </p>
      {/* <h2 className="text-2xl my-4">Our Values</h2>
        <ul className="list-disc list-inside">
          <li className="mb-2">
            Accessibility
          </li>
          <li className="mb-2">
            Neutrality
          </li>
          <li>
            Economy: fostering economic connections, increasing the density of the global trade network, and removing extractive intermediaries.
          </li>
        </ul> */}
      <h2 className="text-2xl my-4">Our Mission</h2>
      <p className="mb-4">
        We&apos;re committed to delivering a simple and inclusive payment experience for users of all backgrounds, languages, cultures, financial literacy levels, and technical skills.
      </p>
      <p className="mb-4">
        We embrace user and provider choice and support a growing variety of tokens, chains, and wallets.
      </p>
      <p className="mb-4">
        3cities is decentralized infrastructure, and is released on IPFS and free forever, with no fees, no servers, no API keys, no signups, and no tracking.<br />
      </p>
      <h2 className="text-2xl my-4">Key Features</h2>
      <ul className="list-disc list-inside">
        <li className="mb-2">
          Token Abstraction: Focus on the currency amount, and 3cities figures out the best token to use for each payment.
        </li>
        <li>
          Chain Abstraction: 3cities monitors all supported tokens and chains in real-time, choosing the best chain for every payment.
        </li>
      </ul>
      <h2 className="text-2xl my-4">Supported Assets and Networks</h2>
      <p className="mb-4">
        Currencies: {allLogicalAssetTickers.filter(t => t === 'USD').join(", ")} (ETH and EUR coming soon)
      </p>
      <p className="mb-4">
        Tokens: {allTokenTickers.filter(t => logicalAssetsByTicker['USD'].supportedTokenTickers[t] === true).join(", ")}
      </p>
      <p>
        Chains: {chainsSupportedBy3cities.map(c => c.name).join(", ")}
      </p>
      <h2 className="text-2xl my-4">Products</h2>
      <ul className="list-disc list-inside">
        <li className="mb-2">
          <Link to="/request-money" className="text-primary sm:hover:text-primary-darker">
            Send a Payment Link
          </Link>
          : Request money from anyone by sending them a link. They can pay with any wallet. The link is private unless publicly posted. Our default tokens and chains work for most users, but can be customized easily.
        </li>
        <li className="mb-2">
          Donations: Accept crypto donations <span className="text-secondary">(coming soon)</span>
        </li>
        <li>
          Point-of-Sale: Accept crypto payments as an in-person merchant  <span className="text-secondary">(coming soon)</span>
        </li>
      </ul>
    </div>
  </div>);
};
