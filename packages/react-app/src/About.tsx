import React from "react";
import { FaTelegram, FaTwitter } from "react-icons/fa6";
import { Link } from 'react-router-dom';
import { chainsSupportedBy3cities } from "./chains";
import { allLogicalAssetTickers } from "./logicalAssets";
import { getAllNativeCurrenciesAndTokensForLogicalAssetTicker, isTokenTickerSupportedByLogicalAsset } from "./logicalAssetsToTokens";
import { allTokenTickers } from "./tokens";

export const About: React.FC = () => {
  return <div className="mt-8 text-left max-w-2xl mx-auto">
    <h1 className="text-center text-3xl mb-4">About 3cities</h1>
    <div className="sm:hidden w-full mb-4 flex justify-center gap-2">
      <a href="https://twitter.com/3cities_xyz" target="_blank" rel="noreferrer" className="flex flex-none w-12 items-center gap-1 rounded-md px-2.5 py-1.5 transition sm:hover:bg-black sm:hover:bg-opacity-10 justify-center text-lg">
        <FaTwitter />
      </a>
      <a href="https://t.me/+aMJE0gxJg9c2NWNh" target="_blank" rel="noreferrer" className="flex flex-none w-12 items-center gap-1 rounded-md px-2.5 py-1.5 transition sm:hover:bg-black sm:hover:bg-opacity-10 justify-center text-lg">
        <FaTelegram />
      </a>
    </div>
    <p className="mb-4">
      Request money from anybody in the world by sending them a Pay Link.
    </p>
    <p className="mb-4">
      It&apos;s fast and free.
    </p>
    <p className="mb-4">
      You need an Ethereum address or ENS name.
    </p>
    <p className="mb-4">
      No sign-up and no connect wallet required.
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
    <h2 className="text-2xl mt-8 mb-4">Our Mission</h2>
    <p className="mb-4">
      3cities is a payments app focused on accessibility and credible neutrality.
    </p>
    <p className="mb-4">
      We&apos;re committed to delivering a simple and inclusive payment experience for users of all backgrounds, languages, cultures, financial literacy levels, and technical skills.
    </p>
    <p className="mb-4">
      We embrace user and provider choice and support a growing variety of currencies, tokens, chains, and wallets.
    </p>
    <p className="mb-4">
      3cities is decentralized infrastructure, and is released on IPFS and free forever, with no fees, no servers, no API keys, no signups, and no tracking.<br />
    </p>
    <h2 className="text-2xl mt-8 mb-4">Key Features</h2>
    <ul className="list-disc list-inside">
      <li className="mb-2">
        Token Abstraction: focus on the currency amount, and 3cities figures out the best token to use for each payment.
      </li>
      <li className="mb-2">
        Chain Abstraction: 3cities monitors all supported tokens and chains in real-time, choosing the best chain for every payment.
      </li>
    </ul>
    <h2 className="text-2xl mt-8 mb-4">Supported Assets and Networks</h2>
    <p className="mb-4">
      Currencies: {allLogicalAssetTickers.filter(lat => getAllNativeCurrenciesAndTokensForLogicalAssetTicker(lat).length > 0).join(", ") /* ie. our customer-facing list of supported currencies are the logical assets with at least one supported native currecny or token */}
    </p>
    <p className="mb-4">
      Tokens: {allLogicalAssetTickers.flatMap(lat => allTokenTickers.filter(isTokenTickerSupportedByLogicalAsset.bind(null, lat))).join(', ')}
    </p>
    <p>
      Chains: {chainsSupportedBy3cities.map(c => c.name).join(", ")}
    </p>
    <h2 className="text-2xl mt-8 mb-4">Products</h2>
    <ul className="list-disc list-inside">
      <li className="mb-2">
        <Link to="/pay-link" className="text-primary sm:hover:text-primary-darker">
          Pay Links
        </Link>
        . Request money from anyone by sending them a link. They can pay with any Ethereum wallet. The link is private unless publicly posted.
      </li>
      <li className="mb-2">
        Donations. Accept donations. <span className="text-secondary">(coming soon)</span>
      </li>
      <li className="mb-2">
        Paywall. Allow users to unlock paid content. <span className="text-secondary">(roadmap)</span>
      </li>
      <li className="mb-2">
        Point-of-Sale. Take in-person payments. <span className="text-secondary">(roadmap)</span>
      </li>
      <li className="mb-2">
        E-commerce. Offer payment methods in Shopify &amp; more. <span className="text-secondary">(roadmap)</span>
      </li>
    </ul>
    <h2 className="text-2xl mt-8 mb-4">Integration Types</h2>
    <ul className="list-disc list-inside">
      <li className="mb-2">
        Links. Share a link to get paid.
      </li>
      <li className="mb-2">
        HTML and React embeds. Paste one line of code to add in-page payments to your website or app.
      </li>
      <li className="mb-2">
        SDK. Build links and embeds programmatically. <span className="text-secondary">(coming soon)</span>
      </li>
    </ul>
  </div>;
};
